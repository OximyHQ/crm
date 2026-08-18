import { z } from "zod";

export const connectPayload = z.object({
	apiKey: z.string().trim().min(32).max(500),
	webhookUrl: z.url(),
});

export const disconnectPayload = z.object({
	apiKey: z.string().trim().min(32).max(500),
	webhookId: z.string().trim().min(1).max(200),
});

export const userSnapshot = z.object({
	id: z.string(),
	email: z.email(),
	firstName: z.string(),
	lastName: z.string(),
	role: z.string(),
});

export const phoneNumberSnapshot = z.object({
	id: z.string(),
	name: z.string(),
	number: z.string(),
	formattedNumber: z.string(),
	restrictions: z.object({
		calling: z.record(z.string(), z.string()),
		messaging: z.record(z.string(), z.string()),
	}),
});

const contactFieldValue = z.object({
	id: z.string().optional(),
	name: z.string(),
	value: z.string(),
});

export const contactSnapshot = z.object({
	id: z.string(),
	externalId: z.string().nullable().optional(),
	source: z.string().nullable().optional(),
	defaultFields: z.object({
		company: z.string().nullable().optional(),
		emails: z.array(contactFieldValue).default([]),
		firstName: z.string().nullable().optional(),
		lastName: z.string().nullable().optional(),
		phoneNumbers: z.array(contactFieldValue).default([]),
		role: z.string().nullable().optional(),
	}),
});

export const connectionReply = z.object({
	webhookId: z.string().min(1),
	webhookSecret: z.string().startsWith("whsec_"),
	phoneNumbers: z.array(phoneNumberSnapshot),
	users: z.array(userSnapshot),
});

const identifierContext = z.object({
	conversationId: z.string().trim().min(1),
	orgId: z.string().trim().min(1),
	phoneNumberId: z.string().trim().min(1),
	userId: z.string().trim().min(1).nullable().optional(),
	contacts: z
		.object({
			ids: z.array(z.string()),
			lookupStatus: z.string(),
		})
		.optional(),
});

const callContext = identifierContext.extend({
	participants: z.object({
		external: z.array(z.string()).min(1),
		workspace: z.array(z.string()).min(1),
		resolution: z.string(),
	}),
});

const messageContext = identifierContext.extend({
	recipientIdentifiers: z.array(z.string()),
	senderIdentifier: z.string(),
});

const links = z.object({ quo: z.url() });

const baseEvent = z.object({
	id: z.string().trim().min(1).max(200),
	apiVersion: z.string(),
	createdAt: z.iso.datetime(),
});

const callResource = z.object({
	id: z.string(),
	direction: z.enum(["incoming", "outgoing"]),
	createdAt: z.iso.datetime(),
	answeredAt: z.iso.datetime().nullable().optional(),
	completedAt: z.iso.datetime().nullable().optional(),
	updatedAt: z.iso.datetime().optional(),
	duration: z.number().nonnegative().nullable().optional(),
	status: z.string(),
	hasVoicemail: z.boolean().optional(),
});

export const recordingResource = callResource.extend({
	recordings: z.array(
		z.object({
			id: z.string(),
			duration: z.number().nonnegative(),
			startTime: z.iso.datetime(),
			type: z.string(),
			url: z.url(),
		}),
	),
});

export const summaryResource = z.object({
	callId: z.string(),
	fromPhoneNumber: z.string(),
	answeredByUserId: z.string().nullable().optional(),
	handledByAiAgent: z.boolean(),
	processingStatus: z.string(),
	summary: z.array(z.string()),
	nextSteps: z.array(z.string()),
});

export const transcriptResource = z.object({
	callId: z.string(),
	createdAt: z.iso.datetime(),
	duration: z.number().nonnegative(),
	processingStatus: z.string(),
	dialogue: z.array(
		z.object({
			content: z.string(),
			start: z.number().nonnegative(),
			end: z.number().nonnegative(),
			identifier: z.string(),
			userId: z.string().nullable(),
		}),
	),
});

export const voicemailResource = z.object({
	callId: z.string(),
	id: z.string(),
	voicemailId: z.string(),
	direction: z.enum(["incoming", "outgoing"]),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime().optional(),
	duration: z.number().nonnegative(),
	from: z.string(),
	to: z.string(),
	recordingUrl: z.url(),
	transcript: z.string().nullable(),
});

const messageResource = z.object({
	id: z.string(),
	createdAt: z.iso.datetime(),
	direction: z.enum(["incoming", "outgoing"]),
	media: z.array(z.unknown()),
	status: z.string(),
	text: z.string(),
	errorCode: z.string().nullable().optional(),
});

function event<
	Type extends string,
	Context extends z.ZodType,
	Resource extends z.ZodType,
>(type: Type, context: Context, resource: Resource) {
	return baseEvent.extend({
		type: z.literal(type),
		data: z.object({ context, links, resource }),
	});
}

export const webhookEvent = z.discriminatedUnion("type", [
	event("call.completed", callContext, callResource),
	event("call.recording.completed", callContext, recordingResource),
	event("call.summary.completed", callContext, summaryResource),
	event("call.transcript.completed", callContext, transcriptResource),
	event("call.voicemail.completed", callContext, voicemailResource),
	event("message.received", messageContext, messageResource),
	event("message.delivered", messageContext, messageResource),
	event("message.failed", messageContext, messageResource),
	event("message.undelivered", messageContext, messageResource),
]);

export const eventTaskPayload = webhookEvent;

export const contactSyncTaskPayload = z.object({
	contactId: z.string().trim().min(1).max(200),
});

export type QuoWebhookEvent = z.infer<typeof webhookEvent>;
