import { describe, expect, it } from "bun:test";
import { createHmac } from "node:crypto";
import { verifyGranolaWebhook } from "../src/granola/granola-webhook";

describe("Granola webhook verification", () => {
	it("accepts a current Standard Webhooks signature", () => {
		const secret = "whsec_c2lnbmluZy1zZWNyZXQ=";
		const rawBody = JSON.stringify({
			event_id: "event-1",
			event_type: "note.generated",
			note_id: "not_12345678901234",
			occurred_at: "2026-08-13T02:00:00.000Z",
		});
		const timestamp = "1786586400";
		const signature = createHmac(
			"sha256",
			Buffer.from(secret.slice("whsec_".length), "base64"),
		)
			.update(`event-1.${timestamp}.${rawBody}`, "utf8")
			.digest("base64");

		expect(
			verifyGranolaWebhook({
				rawBody,
				secret,
				webhookId: "event-1",
				webhookTimestamp: timestamp,
				webhookSignature: `v1,${signature}`,
				now: new Date("2026-08-13T02:00:00.000Z"),
			}),
		).toBe(true);
	});

	it("rejects a valid signature after the replay window", () => {
		const secret = "whsec_c2lnbmluZy1zZWNyZXQ=";
		const rawBody = "{}";
		const timestamp = "1786586400";
		const signature = createHmac(
			"sha256",
			Buffer.from(secret.slice("whsec_".length), "base64"),
		)
			.update(`event-1.${timestamp}.${rawBody}`, "utf8")
			.digest("base64");

		expect(
			verifyGranolaWebhook({
				rawBody,
				secret,
				webhookId: "event-1",
				webhookTimestamp: timestamp,
				webhookSignature: `v1,${signature}`,
				now: new Date("2026-08-13T02:06:00.000Z"),
			}),
		).toBe(false);
	});

	it("rejects a changed request body", () => {
		expect(
			verifyGranolaWebhook({
				rawBody: '{"changed":true}',
				secret: "whsec_c2lnbmluZy1zZWNyZXQ=",
				webhookId: "event-1",
				webhookTimestamp: "1786586400",
				webhookSignature: "v1,aW52YWxpZA==",
				now: new Date("2026-08-13T02:00:00.000Z"),
			}),
		).toBe(false);
	});
});
