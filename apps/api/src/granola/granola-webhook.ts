import { createHmac, timingSafeEqual } from "node:crypto";
import { GRANOLA } from "./granola-config";

export function verifyGranolaWebhook(input: {
	rawBody: string;
	secret: string;
	webhookId: string;
	webhookTimestamp: string;
	webhookSignature: string;
	now?: Date;
}): boolean {
	if (!input.secret.startsWith("whsec_")) return false;

	const timestampSeconds = Number(input.webhookTimestamp);
	if (!Number.isFinite(timestampSeconds)) return false;
	const now = input.now ?? new Date();
	const age = Math.abs(now.getTime() - timestampSeconds * 1000);
	if (age > GRANOLA.webhook.maxAgeMs) return false;

	const key = Buffer.from(input.secret.slice("whsec_".length), "base64");
	const expected = Buffer.from(
		createHmac("sha256", key)
			.update(
				`${input.webhookId}.${input.webhookTimestamp}.${input.rawBody}`,
				"utf8",
			)
			.digest("base64"),
	);

	return input.webhookSignature.split(" ").some((versioned) => {
		const [version, signature = ""] = versioned.split(",");
		const provided = Buffer.from(signature);
		return (
			version === "v1" &&
			provided.length === expected.length &&
			timingSafeEqual(provided, expected)
		);
	});
}
