import { z } from "zod";

export const communicationListInput = z.object({
	q: z.string().trim().max(200).default(""),
	filter: z.enum(["all", "calls", "messages", "review"]).default("all"),
	page: z.number().int().min(1).default(1),
	pageSize: z.number().int().min(1).max(100).default(50),
});

export const communicationIdInput = z.object({
	id: z.string().trim().min(1).max(200),
});

export const communicationResolveInput = z.discriminatedUnion("action", [
	z.object({
		action: z.literal("attach"),
		communicationId: z.string().trim().min(1).max(200),
		contactId: z.string().trim().min(1).max(200),
	}),
	z.object({
		action: z.literal("ignore"),
		communicationId: z.string().trim().min(1).max(200),
	}),
]);

export const communicationContactOptionsInput = z.object({
	q: z.string().trim().max(200).default(""),
});
