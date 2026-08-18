import { describe, expect, it } from "bun:test";
import { createHmac } from "node:crypto";
import { schemas } from "@crm/validation";
import { verifyStandardWebhook } from "../src/integrations/standard-webhook";

const base = {
	id: "msg_event_1",
	apiVersion: "2026-03-30",
	createdAt: "2026-08-17T18:00:00.000Z",
};

const callContext = {
	conversationId: "CN123",
	orgId: "OR123",
	phoneNumberId: "PN123",
	userId: "US123",
	participants: {
		external: ["+14155550100"],
		workspace: ["+14155550200"],
		resolution: "available",
	},
};

const messageContext = {
	conversationId: "CN123",
	orgId: "OR123",
	phoneNumberId: "PN123",
	userId: "US123",
	senderIdentifier: "+14155550100",
	recipientIdentifiers: ["+14155550200"],
};

const links = { quo: "https://my.quo.com/inbox/CN123" };

describe("Quo webhook", () => {
	it("accepts a current Standard Webhooks signature", () => {
		const secret = "whsec_c2lnbmluZy1zZWNyZXQ=";
		const rawBody = JSON.stringify({
			id: "EV_payload_event_1",
			type: "message.received",
		});
		const timestamp = "1786989600";
		const signature = createHmac(
			"sha256",
			Buffer.from(secret.slice("whsec_".length), "base64"),
		)
			.update(`msg_event_1.${timestamp}.${rawBody}`, "utf8")
			.digest("base64");

		expect(
			verifyStandardWebhook({
				rawBody,
				secret,
				webhookId: "msg_event_1",
				webhookTimestamp: timestamp,
				webhookSignature: `v1,${signature}`,
				maxAgeMs: 300_000,
				now: new Date("2026-08-17T18:00:00.000Z"),
			}),
		).toBe(true);
	});

	it("parses every subscribed event shape", () => {
		const events = [
			{
				...base,
				type: "call.completed",
				data: {
					context: callContext,
					links,
					resource: {
						id: "AC123",
						direction: "incoming",
						status: "answered",
						createdAt: base.createdAt,
						duration: 42,
					},
				},
			},
			{
				...base,
				type: "call.recording.completed",
				data: {
					context: callContext,
					links,
					resource: {
						id: "AC123",
						direction: "incoming",
						status: "answered",
						createdAt: base.createdAt,
						recordings: [
							{
								id: "recording-1",
								duration: 42,
								startTime: base.createdAt,
								type: "audio/mpeg",
								url: "https://example.com/recording.mp3",
							},
						],
					},
				},
			},
			{
				...base,
				type: "call.summary.completed",
				data: {
					context: callContext,
					links,
					resource: {
						callId: "AC123",
						fromPhoneNumber: "+14155550100",
						answeredByUserId: "US123",
						handledByAiAgent: false,
						processingStatus: "completed",
						summary: ["Discussed renewal."],
						nextSteps: ["Send proposal."],
					},
				},
			},
			{
				...base,
				type: "call.transcript.completed",
				data: {
					context: callContext,
					links,
					resource: {
						callId: "AC123",
						createdAt: base.createdAt,
						duration: 42,
						processingStatus: "completed",
						dialogue: [
							{
								content: "Hello",
								start: 0,
								end: 1,
								identifier: "+14155550100",
								userId: null,
							},
						],
					},
				},
			},
			{
				...base,
				type: "call.voicemail.completed",
				data: {
					context: callContext,
					links,
					resource: {
						callId: "AC123",
						id: "VM123",
						voicemailId: "VM123",
						direction: "incoming",
						createdAt: base.createdAt,
						duration: 12,
						from: "+14155550100",
						to: "+14155550200",
						recordingUrl: "https://example.com/voicemail.mp3",
						transcript: "Please call back.",
					},
				},
			},
			...[
				"message.received",
				"message.delivered",
				"message.failed",
				"message.undelivered",
			].map((type) => ({
				...base,
				type,
				data: {
					context: messageContext,
					links,
					resource: {
						id: "MM123",
						createdAt: base.createdAt,
						direction: "incoming",
						media: [],
						status: type.split(".")[1],
						text: "Hello",
						errorCode: type.includes("failed") ? "failed" : null,
					},
				},
			})),
		];

		for (const event of events) {
			expect(schemas.quo.webhookEvent.safeParse(event).success).toBe(true);
		}
	});

	it("parses Quo API webhook payloads", () => {
		const events = [
			{
				...base,
				object: "event",
				type: "call.completed",
				data: {
					object: {
						id: "AC123",
						object: "call",
						answeredAt: base.createdAt,
						completedAt: base.createdAt,
						createdAt: base.createdAt,
						direction: "outgoing",
						duration: 42,
						phoneNumberId: "PN123",
						participants: ["+14155550100"],
						status: "completed",
						userId: "US123",
						contactIds: ["CT123"],
					},
				},
			},
			{
				...base,
				object: "event",
				type: "call.summary.completed",
				data: {
					object: {
						object: "callSummary",
						callId: "AC123",
						status: "completed",
						summary: ["Discussed renewal."],
						nextSteps: ["Send proposal."],
						contactIds: ["CT123"],
					},
				},
			},
			{
				...base,
				object: "event",
				type: "call.recording.completed",
				data: {
					object: {
						id: "AC123",
						object: "call",
						answeredAt: base.createdAt,
						completedAt: base.createdAt,
						createdAt: base.createdAt,
						direction: "outgoing",
						duration: 42,
						phoneNumberId: "PN123",
						participants: ["+14155550100"],
						status: "completed",
						userId: "US123",
						contactIds: ["CT123"],
						media: [
							{
								url: "https://example.com/recording.mp3",
								type: "audio/mpeg",
								duration: 42,
							},
						],
					},
				},
			},
			{
				...base,
				object: "event",
				type: "call.transcript.completed",
				data: {
					object: {
						object: "callTranscript",
						callId: "AC123",
						createdAt: base.createdAt,
						dialogue: [
							{
								content: "Hello",
								start: 0,
								end: 1,
								identifier: "+14155550100",
								userId: "US123",
							},
						],
						duration: 42,
						status: "completed",
						contactIds: ["CT123"],
					},
				},
			},
		];

		for (const event of events) {
			expect(schemas.quo.webhookEvent.safeParse(event).success).toBe(true);
		}

		const call = schemas.quo.webhookEvent.parse(events[0]);
		expect(call.type).toBe("call.completed");
		if (call.type !== "call.completed")
			throw new Error("Expected a call event.");
		expect(call.data.context.phoneNumberId).toBe("PN123");
		expect(call.data.context.participants.external).toEqual(["+14155550100"]);
	});

	it("parses a call artifact without a status", () => {
		const event = {
			...base,
			type: "call.recording.completed",
			data: {
				context: callContext,
				links,
				resource: {
					id: "AC123",
					direction: "outgoing",
					createdAt: base.createdAt,
					recordings: [],
				},
			},
		};

		expect(schemas.quo.webhookEvent.safeParse(event).success).toBe(true);
	});
});
