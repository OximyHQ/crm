import { verifyStandardWebhook } from "../integrations/standard-webhook";
import { GRANOLA } from "./granola-config";

export function verifyGranolaWebhook(input: {
	rawBody: string;
	secret: string;
	webhookId: string;
	webhookTimestamp: string;
	webhookSignature: string;
	now?: Date;
}): boolean {
	return verifyStandardWebhook({
		...input,
		maxAgeMs: GRANOLA.webhook.maxAgeMs,
	});
}
