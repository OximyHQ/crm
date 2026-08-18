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
	orgId: z.string().trim().min(1).optional(),
	phoneNumberId: z.string().trim().min(1).optional(),
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
		external: z.array(z.string()),
		workspace: z.array(z.string()),
		resolution: z.string(),
	}),
});

const messageContext = identifierContext.extend({
	recipientIdentifiers: z.array(z.string()),
	senderIdentifier: z.string(),
});

const links = z.object({ quo: z.url().optional() });

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
	fromPhoneNumber: z.string().optional(),
	answeredByUserId: z.string().nullable().optional(),
	handledByAiAgent: z.boolean().optional(),
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

const contextualWebhookEvent = z.discriminatedUnion("type", [
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

const apiEnvelope = baseEvent.extend({
	object: z.literal("event").optional(),
	type: z.string(),
	data: z.object({ object: z.unknown() }),
});

const apiRecording = z.object({
	id: z.string().optional(),
	duration: z.number().nonnegative().optional(),
	startTime: z.iso.datetime().optional(),
	type: z.string().optional(),
	url: z.url(),
});

const apiCall = z.object({
	id: z.string(),
	object: z.literal("call").optional(),
	direction: z.enum(["incoming", "outgoing"]),
	status: z.string(),
	createdAt: z.iso.datetime(),
	answeredAt: z.iso.datetime().nullable().optional(),
	completedAt: z.iso.datetime().nullable().optional(),
	updatedAt: z.iso.datetime().optional(),
	duration: z.number().nonnegative().nullable().optional(),
	phoneNumberId: z.string(),
	participants: z.array(z.string()).optional(),
	userId: z.string().nullable().optional(),
	conversationId: z.string().optional(),
	from: z.string().optional(),
	to: z.union([z.string(), z.array(z.string())]).optional(),
	contactIds: z.array(z.string()).default([]),
	media: z.array(apiRecording).default([]),
	recordings: z.array(apiRecording).default([]),
});

const apiSummary = z.object({
	object: z.literal("callSummary").optional(),
	callId: z.string(),
	status: z.string(),
	summary: z.array(z.string()),
	nextSteps: z.array(z.string()),
	contactIds: z.array(z.string()).default([]),
});

const apiTranscript = z.object({
	object: z.literal("callTranscript").optional(),
	callId: z.string(),
	createdAt: z.iso.datetime(),
	dialogue: z.array(
		z.object({
			content: z.string(),
			start: z.number().nonnegative(),
			end: z.number().nonnegative(),
			identifier: z.string(),
			userId: z.string().nullable(),
		}),
	),
	duration: z.number().nonnegative(),
	status: z.string(),
	contactIds: z.array(z.string()).default([]),
});

const apiMessage = z.object({
	id: z.string(),
	object: z.literal("message").optional(),
	from: z.string(),
	to: z.union([z.string(), z.array(z.string())]),
	direction: z.enum(["incoming", "outgoing"]),
	text: z.string().optional(),
	body: z.string().optional(),
	media: z.array(z.unknown()).default([]),
	status: z.string(),
	createdAt: z.iso.datetime(),
	userId: z.string().nullable().optional(),
	phoneNumberId: z.string(),
	conversationId: z.string().optional(),
	contactIds: z.array(z.string()).default([]),
	errorCode: z.string().nullable().optional(),
});

function apiCallContext(call: z.infer<typeof apiCall>) {
	const recipients = Array.isArray(call.to)
		? call.to
		: call.to
			? [call.to]
			: [];
	const external =
		call.participants ??
		(call.direction === "incoming" ? [call.from].filter(Boolean) : recipients);
	return {
		conversationId: call.conversationId ?? call.id,
		phoneNumberId: call.phoneNumberId,
		userId: call.userId,
		contacts: { ids: call.contactIds, lookupStatus: "provided" },
		participants: { external, workspace: [], resolution: "provided" },
	};
}

function normalizeApiEvent(value: unknown): unknown {
	const envelope = apiEnvelope.safeParse(value);
	if (!envelope.success) return value;
	const common = {
		id: envelope.data.id,
		apiVersion: envelope.data.apiVersion,
		createdAt: envelope.data.createdAt,
	};

	if (
		envelope.data.type === "call.completed" ||
		envelope.data.type === "call.recording.completed"
	) {
		const call = apiCall.safeParse(envelope.data.data.object);
		if (!call.success) return value;
		const context = apiCallContext(call.data);
		const resource = {
			id: call.data.id,
			direction: call.data.direction,
			createdAt: call.data.createdAt,
			answeredAt: call.data.answeredAt,
			completedAt: call.data.completedAt,
			updatedAt: call.data.updatedAt,
			duration: call.data.duration,
			status: call.data.status,
		};
		if (envelope.data.type === "call.completed") {
			return {
				...common,
				type: envelope.data.type,
				data: { context, links: {}, resource },
			};
		}
		const recordings = [...call.data.recordings, ...call.data.media].map(
			(recording, index) => ({
				id: recording.id ?? `recording-${index + 1}`,
				duration: recording.duration ?? call.data.duration ?? 0,
				startTime: recording.startTime ?? call.data.createdAt,
				type: recording.type ?? "audio/mpeg",
				url: recording.url,
			}),
		);
		return {
			...common,
			type: envelope.data.type,
			data: { context, links: {}, resource: { ...resource, recordings } },
		};
	}

	if (
		envelope.data.type === "call.summary.completed" ||
		envelope.data.type === "callSummary"
	) {
		const summary = apiSummary.safeParse(envelope.data.data.object);
		if (!summary.success) return value;
		return {
			...common,
			type: "call.summary.completed",
			data: {
				context: {
					conversationId: summary.data.callId,
					contacts: { ids: summary.data.contactIds, lookupStatus: "provided" },
					participants: {
						external: [],
						workspace: [],
						resolution: "unavailable",
					},
				},
				links: {},
				resource: {
					callId: summary.data.callId,
					processingStatus: summary.data.status,
					summary: summary.data.summary,
					nextSteps: summary.data.nextSteps,
				},
			},
		};
	}

	if (
		envelope.data.type === "call.transcript.completed" ||
		envelope.data.type === "callTranscript"
	) {
		const transcript = apiTranscript.safeParse(envelope.data.data.object);
		if (!transcript.success) return value;
		return {
			...common,
			type: "call.transcript.completed",
			data: {
				context: {
					conversationId: transcript.data.callId,
					contacts: {
						ids: transcript.data.contactIds,
						lookupStatus: "provided",
					},
					participants: {
						external: [],
						workspace: [],
						resolution: "unavailable",
					},
				},
				links: {},
				resource: {
					callId: transcript.data.callId,
					createdAt: transcript.data.createdAt,
					duration: transcript.data.duration,
					processingStatus: transcript.data.status,
					dialogue: transcript.data.dialogue,
				},
			},
		};
	}

	if (envelope.data.type.startsWith("message.")) {
		const message = apiMessage.safeParse(envelope.data.data.object);
		if (!message.success) return value;
		const recipients = Array.isArray(message.data.to)
			? message.data.to
			: [message.data.to];
		return {
			...common,
			type: envelope.data.type,
			data: {
				context: {
					conversationId: message.data.conversationId ?? message.data.id,
					phoneNumberId: message.data.phoneNumberId,
					userId: message.data.userId,
					contacts: { ids: message.data.contactIds, lookupStatus: "provided" },
					senderIdentifier: message.data.from,
					recipientIdentifiers: recipients,
				},
				links: {},
				resource: {
					id: message.data.id,
					createdAt: message.data.createdAt,
					direction: message.data.direction,
					media: message.data.media,
					status: message.data.status,
					text: message.data.text ?? message.data.body ?? "",
					errorCode: message.data.errorCode,
				},
			},
		};
	}

	return value;
}

export const webhookEvent = z.preprocess(
	normalizeApiEvent,
	contextualWebhookEvent,
);

export const eventTaskPayload = webhookEvent;

export const contactSyncTaskPayload = z.object({
	contactId: z.string().trim().min(1).max(200),
});

export type QuoWebhookEvent = z.infer<typeof webhookEvent>;
