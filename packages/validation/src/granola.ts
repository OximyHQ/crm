import { z } from "zod";

export const scope = z.enum(["personal", "public"]);

export const connectPayload = z.object({
	apiKey: z.string().trim().min(8).max(500),
	folderId: z
		.string()
		.trim()
		.regex(/^fol_[a-zA-Z0-9]{14}$/)
		.optional(),
	scope,
	webhookUrl: z.url(),
});

export const disconnectPayload = z.object({
	apiKey: z.string().trim().min(8).max(500),
	webhookEndpointId: z.string().trim().min(1).max(200),
});

export const noteTaskPayload = z.object({
	noteId: z
		.string()
		.trim()
		.regex(/^not_[a-zA-Z0-9]{14}$/),
	eventId: z.string().trim().min(1).max(200),
	eventType: z.string().trim().min(1).max(100),
});
