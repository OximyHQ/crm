import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { db } from "@crm/db";
import { schemas } from "@crm/validation";
import { fileQuoEvent } from "../agent/lib/quo-task";

const PREFIX = "quo-task-spec";
const USER_ID = `${PREFIX}-user`;
const COMPANY_ID = `${PREFIX}-company`;
const CONTACT_ID = `${PREFIX}-contact`;
const CALL_ID = `${PREFIX}-call`;
const UNKNOWN_CALL_ID = `${PREFIX}-unknown-call`;
const MESSAGE_ID = `${PREFIX}-message`;
const CREATED_AT = "2026-08-17T18:00:00.000Z";

const users = [
	{
		id: "US123",
		email: "quo-owner@internal.test",
		firstName: "Quo",
		lastName: "Owner",
		role: "owner",
	},
];

const callContext = {
	conversationId: "CN-call",
	orgId: "OR123",
	phoneNumberId: "PN123",
	userId: "US123",
	participants: {
		external: ["+14155550100"],
		workspace: ["+14155550200"],
		resolution: "available",
	},
};

beforeEach(async () => {
	await db.communication.deleteMany({
		where: {
			provider: "quo",
			externalId: { in: [CALL_ID, UNKNOWN_CALL_ID, MESSAGE_ID] },
		},
	});
	await db.contact.deleteMany({ where: { id: CONTACT_ID } });
	await db.company.deleteMany({ where: { id: COMPANY_ID } });
	await db.user.upsert({
		where: { id: USER_ID },
		create: {
			id: USER_ID,
			name: "Quo Owner",
			email: "quo-owner@internal.test",
		},
		update: {},
	});
	await db.company.create({
		data: { id: COMPANY_ID, name: "Quo Customer" },
	});
	await db.contact.create({
		data: {
			id: CONTACT_ID,
			firstName: "Phone",
			lastName: "Contact",
			phone: "(415) 555-0100",
			companyId: COMPANY_ID,
			phones: {
				create: {
					value: "(415) 555-0100",
					e164: "+14155550100",
					primary: true,
				},
			},
		},
	});
});

afterEach(async () => {
	await db.communication.deleteMany({
		where: {
			provider: "quo",
			externalId: { in: [CALL_ID, UNKNOWN_CALL_ID, MESSAGE_ID] },
		},
	});
	await db.contact.deleteMany({ where: { id: CONTACT_ID } });
	await db.company.deleteMany({ where: { id: COMPANY_ID } });
	await db.user.deleteMany({ where: { id: USER_ID } });
});

describe("filing Quo activity", () => {
	it("merges call details and files one exact phone match", async () => {
		await fileQuoEvent(
			schemas.quo.webhookEvent.parse({
				id: "event-call",
				apiVersion: "2026-03-30",
				type: "call.completed",
				createdAt: CREATED_AT,
				data: {
					context: callContext,
					links: { quo: "https://my.quo.com/inbox/CN-call" },
					resource: {
						id: CALL_ID,
						direction: "incoming",
						status: "answered",
						createdAt: CREATED_AT,
						duration: 42,
					},
				},
			}),
			"test-key",
			users,
		);
		await fileQuoEvent(
			schemas.quo.webhookEvent.parse({
				id: "event-summary",
				apiVersion: "2026-03-30",
				type: "call.summary.completed",
				createdAt: "2026-08-17T18:01:00.000Z",
				data: {
					context: callContext,
					links: { quo: "https://my.quo.com/inbox/CN-call" },
					resource: {
						callId: CALL_ID,
						fromPhoneNumber: "+14155550100",
						answeredByUserId: "US123",
						handledByAiAgent: false,
						processingStatus: "completed",
						summary: ["The customer approved the proposal."],
						nextSteps: ["Send the contract."],
					},
				},
			}),
			"test-key",
			users,
		);
		await fileQuoEvent(
			schemas.quo.webhookEvent.parse({
				id: "event-transcript",
				apiVersion: "2026-03-30",
				type: "call.transcript.completed",
				createdAt: "2026-08-17T18:01:00.000Z",
				data: {
					context: callContext,
					links: { quo: "https://my.quo.com/inbox/CN-call" },
					resource: {
						callId: CALL_ID,
						createdAt: CREATED_AT,
						duration: 42,
						processingStatus: "completed",
						dialogue: [
							{
								content: "We approve.",
								start: 0,
								end: 2,
								identifier: "+14155550100",
								userId: null,
							},
						],
					},
				},
			}),
			"test-key",
			users,
		);

		const activities = await db.activity.findMany({
			where: { communication: { provider: "quo", externalId: CALL_ID } },
			select: {
				type: true,
				subject: true,
				body: true,
				occurredAt: true,
				contactId: true,
				companyId: true,
				communication: {
					select: {
						matchStatus: true,
						status: true,
						artifacts: {
							select: { type: true, payload: true },
						},
					},
				},
			},
		});

		expect(activities).toHaveLength(1);
		expect(activities[0]).toMatchObject({
			type: "CALL",
			subject: "Incoming call",
			body: "The customer approved the proposal.",
			occurredAt: new Date(CREATED_AT),
			contactId: CONTACT_ID,
			companyId: COMPANY_ID,
			communication: { matchStatus: "MATCHED" },
		});
		expect(
			activities[0]?.communication?.artifacts.find(
				(artifact) => artifact.type === "NEXT_STEPS",
			)?.payload,
		).toEqual(["Send the contract."]);
		expect(
			activities[0]?.communication?.artifacts.find(
				(artifact) => artifact.type === "TRANSCRIPT",
			)?.payload,
		).toEqual([
			{
				content: "We approve.",
				start: 0,
				end: 2,
				identifier: "+14155550100",
				userId: null,
			},
		]);
	});

	it("updates one message activity across delivery events", async () => {
		const event = {
			id: "event-message",
			apiVersion: "2026-03-30",
			createdAt: CREATED_AT,
			data: {
				context: {
					conversationId: "CN-message",
					orgId: "OR123",
					phoneNumberId: "PN123",
					userId: "US123",
					senderIdentifier: "+14155550200",
					recipientIdentifiers: ["+14155550100"],
				},
				links: { quo: "https://my.quo.com/inbox/CN-message" },
				resource: {
					id: MESSAGE_ID,
					createdAt: CREATED_AT,
					direction: "outgoing",
					media: [],
					status: "delivered",
					text: "The contract is ready.",
				},
			},
		};
		await fileQuoEvent(
			schemas.quo.webhookEvent.parse({
				...event,
				type: "message.delivered",
			}),
			"test-key",
			users,
		);
		await fileQuoEvent(
			schemas.quo.webhookEvent.parse({
				...event,
				id: "event-message-retry",
				type: "message.delivered",
			}),
			"test-key",
			users,
		);

		expect(
			await db.activity.findMany({
				where: {
					communication: { provider: "quo", externalId: MESSAGE_ID },
				},
				select: {
					type: true,
					subject: true,
					body: true,
					contactId: true,
					communication: { select: { status: true } },
				},
			}),
		).toEqual([
			{
				type: "MESSAGE",
				subject: "Outgoing message",
				body: "The contract is ready.",
				contactId: CONTACT_ID,
				communication: { status: "delivered" },
			},
		]);
	});

	it("keeps an unknown call in review without creating an activity", async () => {
		await fileQuoEvent(
			schemas.quo.webhookEvent.parse({
				id: "event-unknown-call",
				apiVersion: "2026-03-30",
				type: "call.completed",
				createdAt: CREATED_AT,
				data: {
					context: {
						...callContext,
						conversationId: "CN-unknown-call",
						participants: {
							...callContext.participants,
							external: ["+14155550999"],
						},
					},
					links: { quo: "https://my.quo.com/inbox/CN-unknown-call" },
					resource: {
						id: UNKNOWN_CALL_ID,
						direction: "outgoing",
						status: "answered",
						createdAt: CREATED_AT,
						duration: 18,
					},
				},
			}),
			"test-key",
			users,
		);

		const communication = await db.communication.findUnique({
			where: {
				provider_externalId: {
					provider: "quo",
					externalId: UNKNOWN_CALL_ID,
				},
			},
			select: {
				matchStatus: true,
				participants: {
					where: { role: "EXTERNAL" },
					select: { phoneE164: true, contactId: true },
				},
				activity: { select: { id: true } },
			},
		});

		expect(communication).toEqual({
			matchStatus: "NEEDS_REVIEW",
			participants: [{ phoneE164: "+14155550999", contactId: null }],
			activity: null,
		});
	});
});
