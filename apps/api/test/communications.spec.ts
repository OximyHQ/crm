import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { DEFAULT_WORKSPACE_NAME, WORKSPACE_ID } from "@crm/auth";
import { db } from "@crm/db";
import { workspaceSlug } from "@crm/db/workspace";
import { CommunicationsService } from "../src/communications/communications.service";

const suffix = process.env.TEST_RUN_ID ?? "communications-spec";
const userId = `communications-user-${suffix}`;
const memberId = `communications-member-${suffix}`;
const contactId = `communications-contact-${suffix}`;
const communicationIds = [
	`communications-call-one-${suffix}`,
	`communications-call-two-${suffix}`,
];
const phoneE164 = "+14155550888";
const service = new CommunicationsService(db);

beforeAll(async () => {
	await db.communication.deleteMany({
		where: { id: { in: communicationIds } },
	});
	await db.contact.deleteMany({ where: { id: contactId } });
	await db.member.deleteMany({ where: { id: memberId } });
	await db.user.deleteMany({ where: { id: userId } });
	await db.organization.upsert({
		where: { id: WORKSPACE_ID },
		update: {},
		create: {
			id: WORKSPACE_ID,
			name: DEFAULT_WORKSPACE_NAME,
			slug: workspaceSlug(DEFAULT_WORKSPACE_NAME),
			createdAt: new Date(),
		},
	});
	await db.user.create({
		data: {
			id: userId,
			name: "Communications Owner",
			email: `communications.${suffix}@example.test`,
		},
	});
	await db.member.create({
		data: {
			id: memberId,
			organizationId: WORKSPACE_ID,
			userId,
			role: "owner",
			createdAt: new Date(),
		},
	});
	await db.contact.create({
		data: {
			id: contactId,
			firstName: "Mapped",
			lastName: "Caller",
		},
	});
	await db.communication.createMany({
		data: communicationIds.map((id, index) => ({
			id,
			provider: "quo",
			externalId: id,
			kind: "CALL",
			direction: "OUTBOUND",
			status: "completed",
			occurredAt: new Date(`2026-08-17T18:0${index}:00.000Z`),
			matchStatus: "NEEDS_REVIEW",
		})),
	});
	await db.communicationParticipant.createMany({
		data: communicationIds.map((communicationId) => ({
			communicationId,
			role: "EXTERNAL",
			phoneE164,
		})),
	});
});

afterAll(async () => {
	await db.communication.deleteMany({
		where: { id: { in: communicationIds } },
	});
	await db.contact.deleteMany({ where: { id: contactId } });
	await db.member.deleteMany({ where: { id: memberId } });
	await db.user.deleteMany({ where: { id: userId } });
});

describe("CommunicationsService", () => {
	it("maps every unresolved communication for one phone", async () => {
		expect(
			await service.resolve({
				action: "attach",
				communicationId: communicationIds[0] ?? "",
				contactId,
			}),
		).toEqual({ resolved: 2, phoneE164, contactId });

		const communications = await db.communication.findMany({
			where: { id: { in: communicationIds } },
			orderBy: { id: "asc" },
			select: {
				matchStatus: true,
				participants: {
					where: { role: "EXTERNAL" },
					select: { contactId: true },
				},
				activity: { select: { contactId: true } },
			},
		});
		expect(communications).toEqual([
			{
				matchStatus: "MATCHED",
				participants: [{ contactId }],
				activity: { contactId },
			},
			{
				matchStatus: "MATCHED",
				participants: [{ contactId }],
				activity: { contactId },
			},
		]);
		expect(
			await db.contact.findUnique({
				where: { id: contactId },
				select: {
					phone: true,
					phones: {
						select: { e164: true, source: true, verifiedAt: true },
					},
				},
			}),
		).toEqual({
			phone: phoneE164,
			phones: [
				{
					e164: phoneE164,
					source: "MANUAL",
					verifiedAt: expect.any(Date),
				},
			],
		});
	});
});
