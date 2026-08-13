import { schemas } from "@crm/validation";
import { z } from "zod";

export const granolaConnectInput = schemas.granola.connectPayload.omit({
	webhookUrl: true,
});

export type GranolaConnectInput = z.infer<typeof granolaConnectInput>;

export const granolaReviewAssignment = z.object({
	activityId: z.string().trim().min(1).max(200),
	dealId: z.string().trim().min(1).max(200),
});

export const granolaWebhookEvent = z.object({
	event_id: z.string().trim().min(1).max(200),
	event_type: z.enum(["note.access_granted", "note.edited", "note.generated"]),
	note_id: z
		.string()
		.trim()
		.regex(/^not_[a-zA-Z0-9]{14}$/),
	occurred_at: z.iso.datetime(),
	data: z.object({ changed_fields: z.array(z.string()).max(20) }).optional(),
});
