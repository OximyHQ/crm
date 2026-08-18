import {
	type CommunicationArtifactType,
	type CommunicationDirection,
	type CommunicationKind,
	db,
	type Prisma,
} from "@crm/db";
import { mirrorRecording } from "@crm/db/blob";
import { projectCommunication } from "@crm/db/communications";
import { normalizePhone } from "@crm/db/phones";
import { readQuoConnection } from "@crm/db/settings";
import { type QuoWebhookEvent, schemas } from "@crm/validation";
import { getQuoContact } from "./quo-client";

const PROVIDER = "quo";
const PRIMARY_ARTIFACT = "primary";

type Artifact = {
	type: CommunicationArtifactType;
	key: string;
	text?: string | null;
	payload?: Prisma.InputJsonValue;
	sourceUrl?: string | null;
	storedUrl?: string | null;
	durationSeconds?: number | null;
};

type Description = {
	externalId: string;
	externalConversationId: string;
	kind: CommunicationKind;
	direction?: CommunicationDirection;
	status?: string;
	body?: string;
	occurredAt: Date;
	completedAt?: Date | null;
	durationSeconds?: number | null;
	sourceUrl: string;
	providerPhoneNumberId: string;
	providerUserId?: string | null;
	externalPhones: string[];
	providerContactIds: string[];
	artifacts: Artifact[];
};

export async function runQuoEventTask(value: unknown): Promise<string> {
	const event = schemas.quo.eventTaskPayload.parse(value);
	const connection = await readQuoConnection(db);
	if (!connection)
		return "Quo is disconnected, so the communication was not filed.";

	try {
		const result = await fileQuoEvent(
			event,
			connection.apiKey,
			connection.users,
		);
		await db.$transaction(async (tx) => {
			await tx.quoWebhookEvent.updateMany({
				where: { id: event.id },
				data: { processedAt: new Date(), lastError: null },
			});
			await tx.appSetting.updateMany({
				where: { id: "app" },
				data: { quoLastSyncedAt: new Date(), quoLastError: null },
			});
		});
		return result;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		await db.$transaction([
			db.quoWebhookEvent.updateMany({
				where: { id: event.id },
				data: { lastError: message.slice(0, 500) },
			}),
			db.appSetting.updateMany({
				where: { id: "app" },
				data: { quoLastError: message.slice(0, 500) },
			}),
		]);
		throw error;
	}
}

export async function fileQuoEvent(
	event: QuoWebhookEvent,
	apiKey: string,
	users: unknown,
): Promise<string> {
	const description = await describeCommunication(event);
	const existing = await db.communication.findUnique({
		where: {
			provider_externalId: {
				provider: PROVIDER,
				externalId: description.externalId,
			},
		},
		select: {
			id: true,
			matchStatus: true,
			participants: {
				where: { role: "EXTERNAL", contactId: { not: null } },
				select: { contactId: true },
			},
		},
	});
	const createdById = await resolveAuthor(description.providerUserId, users);
	const phone = description.externalPhones[0] ?? null;
	const preservedContactId =
		existing?.matchStatus === "MATCHED"
			? (existing.participants[0]?.contactId ?? null)
			: null;
	const contactId =
		preservedContactId ??
		(await matchContact(phone, description.providerContactIds, apiKey));
	const matchStatus =
		existing?.matchStatus === "IGNORED"
			? "IGNORED"
			: contactId
				? "MATCHED"
				: "NEEDS_REVIEW";

	const communication = await db.communication.upsert({
		where: {
			provider_externalId: {
				provider: PROVIDER,
				externalId: description.externalId,
			},
		},
		create: {
			provider: PROVIDER,
			externalId: description.externalId,
			externalConversationId: description.externalConversationId,
			kind: description.kind,
			direction: description.direction,
			status: description.status,
			body: description.body,
			occurredAt: description.occurredAt,
			completedAt: description.completedAt,
			durationSeconds: description.durationSeconds,
			sourceUrl: description.sourceUrl,
			providerPhoneNumberId: description.providerPhoneNumberId,
			providerUserId: description.providerUserId,
			createdById,
			matchStatus,
		},
		update: {
			externalConversationId: description.externalConversationId,
			...(description.direction ? { direction: description.direction } : {}),
			...(description.status ? { status: description.status } : {}),
			...(description.body ? { body: description.body } : {}),
			...(isPrimaryEvent(event.type)
				? { occurredAt: description.occurredAt }
				: {}),
			...(description.completedAt
				? { completedAt: description.completedAt }
				: {}),
			...(description.durationSeconds !== undefined
				? { durationSeconds: description.durationSeconds }
				: {}),
			sourceUrl: description.sourceUrl,
			providerPhoneNumberId: description.providerPhoneNumberId,
			...(description.providerUserId
				? { providerUserId: description.providerUserId }
				: {}),
			...(createdById ? { createdById } : {}),
			matchStatus,
		},
		select: { id: true },
	});

	await upsertParticipants(communication.id, description, contactId, users);
	await upsertArtifacts(communication.id, description.artifacts);

	if (matchStatus === "MATCHED" && contactId) {
		await projectCommunication(db, communication.id, contactId);
		return `Filed Quo communication ${communication.id} on the matching contact.`;
	}

	if (matchStatus !== "MATCHED") {
		await db.activity.deleteMany({
			where: { communicationId: communication.id },
		});
	}
	return matchStatus === "IGNORED"
		? `Updated ignored Quo communication ${communication.id}.`
		: `Filed Quo communication ${communication.id} for review.`;
}

async function describeCommunication(
	event: QuoWebhookEvent,
): Promise<Description> {
	const context = event.data.context;
	const common = {
		externalConversationId: context.conversationId,
		sourceUrl: event.data.links.quo,
		providerPhoneNumberId: context.phoneNumberId,
		providerContactIds: context.contacts?.ids ?? [],
	};

	switch (event.type) {
		case "call.completed":
			return {
				...common,
				externalId: event.data.resource.id,
				kind: "CALL",
				direction: direction(event.data.resource.direction),
				status: event.data.resource.status,
				occurredAt: new Date(event.data.resource.createdAt),
				completedAt: dateOrNull(event.data.resource.completedAt),
				durationSeconds: event.data.resource.duration,
				providerUserId: context.userId,
				externalPhones: phones(event.data.context.participants.external),
				artifacts: [],
			};
		case "call.recording.completed": {
			const artifacts = await Promise.all(
				event.data.resource.recordings.map(async (recording) => ({
					type: "RECORDING" as const,
					key: recording.id,
					payload: recording as Prisma.InputJsonValue,
					sourceUrl: recording.url,
					storedUrl: await mirrorRecording(
						recording.url,
						`communications/${event.data.resource.id}/${recording.id}`,
					),
					durationSeconds: recording.duration,
				})),
			);
			return {
				...common,
				externalId: event.data.resource.id,
				kind: "CALL",
				direction: direction(event.data.resource.direction),
				status: event.data.resource.status,
				occurredAt: new Date(event.data.resource.createdAt),
				completedAt: dateOrNull(event.data.resource.completedAt),
				durationSeconds: event.data.resource.duration,
				providerUserId: context.userId,
				externalPhones: phones(event.data.context.participants.external),
				artifacts,
			};
		}
		case "call.summary.completed":
			return {
				...common,
				externalId: event.data.resource.callId,
				kind: "CALL",
				occurredAt: new Date(event.createdAt),
				providerUserId: event.data.resource.answeredByUserId ?? context.userId,
				externalPhones: phones(event.data.context.participants.external),
				artifacts: [
					{
						type: "SUMMARY",
						key: PRIMARY_ARTIFACT,
						text: event.data.resource.summary.join("\n\n"),
						payload: event.data.resource.summary,
					},
					{
						type: "NEXT_STEPS",
						key: PRIMARY_ARTIFACT,
						text: event.data.resource.nextSteps.join("\n"),
						payload: event.data.resource.nextSteps,
					},
				],
			};
		case "call.transcript.completed":
			return {
				...common,
				externalId: event.data.resource.callId,
				kind: "CALL",
				occurredAt: new Date(event.data.resource.createdAt),
				durationSeconds: event.data.resource.duration,
				providerUserId: context.userId,
				externalPhones: phones(event.data.context.participants.external),
				artifacts: [
					{
						type: "TRANSCRIPT",
						key: PRIMARY_ARTIFACT,
						text: event.data.resource.dialogue
							.map((line) => `${line.identifier}: ${line.content}`)
							.join("\n"),
						payload: event.data.resource.dialogue,
					},
				],
			};
		case "call.voicemail.completed": {
			const storedUrl = await mirrorRecording(
				event.data.resource.recordingUrl,
				`communications/${event.data.resource.callId}/${event.data.resource.voicemailId}`,
			);
			return {
				...common,
				externalId: event.data.resource.callId,
				kind: "CALL",
				direction: direction(event.data.resource.direction),
				status: "voicemail",
				occurredAt: new Date(event.data.resource.createdAt),
				durationSeconds: event.data.resource.duration,
				providerUserId: context.userId,
				externalPhones: phones(event.data.context.participants.external),
				artifacts: [
					{
						type: "VOICEMAIL",
						key: event.data.resource.voicemailId,
						text: event.data.resource.transcript,
						payload: event.data.resource as Prisma.InputJsonValue,
						sourceUrl: event.data.resource.recordingUrl,
						storedUrl,
						durationSeconds: event.data.resource.duration,
					},
				],
			};
		}
		default:
			return {
				...common,
				externalId: event.data.resource.id,
				kind: "MESSAGE",
				direction: direction(event.data.resource.direction),
				status: event.data.resource.status,
				body: event.data.resource.text,
				occurredAt: new Date(event.data.resource.createdAt),
				providerUserId: context.userId,
				externalPhones: phones(
					event.data.resource.direction === "incoming"
						? [event.data.context.senderIdentifier]
						: event.data.context.recipientIdentifiers,
				),
				artifacts: [],
			};
	}
}

async function matchContact(
	phone: string | null,
	providerContactIds: string[],
	apiKey: string,
): Promise<string | null> {
	if (!phone) return null;
	const exact = await db.contactPhone.findMany({
		where: { e164: phone },
		select: { contactId: true, verifiedAt: true },
		distinct: ["contactId"],
	});
	const verified = exact.filter((item) => item.verifiedAt !== null);
	if (verified.length === 1) return verified[0]?.contactId ?? null;
	if (verified.length > 1) return null;
	if (exact.length === 1) return exact[0]?.contactId ?? null;
	if (exact.length > 1 || providerContactIds.length === 0) return null;

	const remote = await Promise.all(
		providerContactIds.map((id) => getQuoContact(apiKey, id)),
	);
	const emails = remote.flatMap((contact) =>
		contact.defaultFields.emails.map((email) => email.value),
	);
	const contacts = await db.contact.findMany({
		where: { email: { in: emails, mode: "insensitive" } },
		select: { id: true, phone: true },
		take: 2,
	});
	const contact = contacts[0];
	if (contacts.length !== 1 || !contact) return null;
	await db.$transaction(async (tx) => {
		await tx.contactPhone.upsert({
			where: { contactId_e164: { contactId: contact.id, e164: phone } },
			create: {
				contactId: contact.id,
				value: phone,
				e164: phone,
				primary: !contact.phone,
				source: "QUO",
				providerContactId: remote[0]?.id,
			},
			update: { providerContactId: remote[0]?.id },
		});
		if (!contact.phone) {
			await tx.contact.update({
				where: { id: contact.id },
				data: { phone },
			});
		}
	});
	return contact.id;
}

async function upsertParticipants(
	communicationId: string,
	description: Description,
	contactId: string | null,
	users: unknown,
): Promise<void> {
	for (const phoneE164 of description.externalPhones) {
		await db.communicationParticipant.upsert({
			where: {
				communicationId_role_phoneE164: {
					communicationId,
					role: "EXTERNAL",
					phoneE164,
				},
			},
			create: {
				communicationId,
				role: "EXTERNAL",
				phoneE164,
				contactId,
				providerContactId: description.providerContactIds[0],
			},
			update: {
				...(contactId ? { contactId } : {}),
				providerContactId: description.providerContactIds[0],
			},
		});
	}
	const userId = await resolveAuthor(description.providerUserId, users);
	if (!description.providerUserId) return;
	const key = `user:${description.providerUserId}`;
	const existing = await db.communicationParticipant.findFirst({
		where: { communicationId, role: "INTERNAL", providerContactId: key },
		select: { id: true },
	});
	if (existing) {
		await db.communicationParticipant.update({
			where: { id: existing.id },
			data: { userId },
		});
		return;
	}
	await db.communicationParticipant.create({
		data: {
			communicationId,
			role: "INTERNAL",
			providerContactId: key,
			userId,
		},
	});
}

async function upsertArtifacts(
	communicationId: string,
	artifacts: Artifact[],
): Promise<void> {
	for (const artifact of artifacts) {
		await db.communicationArtifact.upsert({
			where: {
				communicationId_type_key: {
					communicationId,
					type: artifact.type,
					key: artifact.key,
				},
			},
			create: { communicationId, ...artifact },
			update: {
				text: artifact.text,
				payload: artifact.payload,
				sourceUrl: artifact.sourceUrl,
				storedUrl: artifact.storedUrl,
				durationSeconds: artifact.durationSeconds,
			},
		});
	}
}

async function resolveAuthor(
	quoUserId: string | null | undefined,
	value: unknown,
): Promise<string | null> {
	const users = schemas.quo.userSnapshot.array().parse(value ?? []);
	const email = users.find((user) => user.id === quoUserId)?.email;
	if (!email) return null;
	const user = await db.user.findFirst({
		where: { email: { equals: email, mode: "insensitive" } },
		select: { id: true },
	});
	return user?.id ?? null;
}

function phones(values: string[]): string[] {
	return [
		...new Set(values.map((value) => normalizePhone(value)).filter(Boolean)),
	] as string[];
}

function direction(value: "incoming" | "outgoing"): CommunicationDirection {
	return value === "incoming" ? "INBOUND" : "OUTBOUND";
}

function dateOrNull(value: string | null | undefined): Date | null {
	return value ? new Date(value) : null;
}

function isPrimaryEvent(type: QuoWebhookEvent["type"]): boolean {
	return (
		type === "call.completed" ||
		type === "call.recording.completed" ||
		type.startsWith("message.")
	);
}
