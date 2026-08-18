import type { Db, Prisma } from "@crm/db";
import { projectCommunication } from "@crm/db/communications";
import { schemas } from "@crm/validation";
import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { z } from "zod";
import { InjectDatabase } from "../database/database.constants";
import type {
	communicationListInput,
	communicationResolveInput,
} from "./communications.contracts";

const COMMUNICATION_SELECT = {
	id: true,
	provider: true,
	externalId: true,
	externalConversationId: true,
	kind: true,
	direction: true,
	status: true,
	body: true,
	occurredAt: true,
	completedAt: true,
	durationSeconds: true,
	sourceUrl: true,
	providerPhoneNumberId: true,
	matchStatus: true,
	createdBy: { select: { id: true, name: true, email: true, image: true } },
	participants: {
		select: {
			id: true,
			role: true,
			phoneE164: true,
			displayName: true,
			contact: {
				select: {
					id: true,
					firstName: true,
					lastName: true,
					email: true,
					company: { select: { id: true, name: true } },
				},
			},
			user: { select: { id: true, name: true, email: true } },
		},
	},
	artifacts: {
		orderBy: { createdAt: "asc" as const },
		select: {
			id: true,
			type: true,
			key: true,
			text: true,
			payload: true,
			sourceUrl: true,
			storedUrl: true,
			durationSeconds: true,
			createdAt: true,
		},
	},
} as const;

const COMMUNICATION_LIST_SELECT = {
	id: true,
	provider: true,
	kind: true,
	direction: true,
	status: true,
	body: true,
	occurredAt: true,
	durationSeconds: true,
	matchStatus: true,
	createdBy: { select: { id: true, name: true, email: true, image: true } },
	participants: {
		where: { role: "EXTERNAL" },
		select: {
			id: true,
			role: true,
			phoneE164: true,
			displayName: true,
			contact: {
				select: {
					id: true,
					firstName: true,
					lastName: true,
					email: true,
					company: { select: { id: true, name: true } },
				},
			},
			user: { select: { id: true, name: true, email: true } },
		},
	},
	artifacts: {
		where: { type: { in: ["SUMMARY", "RECORDING", "VOICEMAIL"] } },
		select: { type: true, text: true },
	},
} satisfies Prisma.CommunicationSelect;

type CommunicationRow = Prisma.CommunicationGetPayload<{
	select: typeof COMMUNICATION_SELECT;
}>;

type CommunicationListRow = Prisma.CommunicationGetPayload<{
	select: typeof COMMUNICATION_LIST_SELECT;
}>;

@Injectable()
export class CommunicationsService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async list(input: z.infer<typeof communicationListInput>) {
		const where = this.where(input);
		const [rows, total] = await Promise.all([
			this.db.communication.findMany({
				where,
				orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
				skip: (input.page - 1) * input.pageSize,
				take: input.pageSize,
				select: COMMUNICATION_LIST_SELECT,
			}),
			this.db.communication.count({ where }),
		]);
		return { rows: rows.map(serializeCommunicationListItem), total };
	}

	async byId(id: string) {
		const communication = await this.db.communication.findUnique({
			where: { id },
			select: COMMUNICATION_SELECT,
		});
		if (!communication) {
			throw new NotFoundException(`No communication with id ${id}.`);
		}
		return serializeCommunication(communication);
	}

	async contactOptions(q: string) {
		return this.db.contact.findMany({
			where: q
				? {
						OR: [
							{ firstName: { contains: q, mode: "insensitive" } },
							{ lastName: { contains: q, mode: "insensitive" } },
							{ email: { contains: q, mode: "insensitive" } },
							{ company: { name: { contains: q, mode: "insensitive" } } },
						],
					}
				: {},
			orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
			take: 30,
			select: {
				id: true,
				firstName: true,
				lastName: true,
				email: true,
				phone: true,
				company: { select: { name: true } },
			},
		});
	}

	async resolve(input: z.infer<typeof communicationResolveInput>) {
		if (input.action === "ignore") {
			const communication = await this.db.communication.findUnique({
				where: { id: input.communicationId },
				select: { id: true },
			});
			if (!communication) {
				throw new NotFoundException(
					`No communication with id ${input.communicationId}.`,
				);
			}
			await this.db.$transaction([
				this.db.communication.update({
					where: { id: input.communicationId },
					data: { matchStatus: "IGNORED" },
				}),
				this.db.activity.deleteMany({
					where: { communicationId: input.communicationId },
				}),
			]);
			return { resolved: 1, phoneE164: null, contactId: null };
		}

		const [communication, contact] = await Promise.all([
			this.db.communication.findUnique({
				where: { id: input.communicationId },
				select: {
					id: true,
					participants: {
						where: { role: "EXTERNAL", phoneE164: { not: null } },
						select: { phoneE164: true },
						take: 1,
					},
				},
			}),
			this.db.contact.findUnique({
				where: { id: input.contactId },
				select: { id: true, phone: true },
			}),
		]);
		const phoneE164 = communication?.participants[0]?.phoneE164;
		if (!communication || !contact) {
			throw new NotFoundException(
				"The communication or contact was not found.",
			);
		}
		if (!phoneE164) {
			throw new BadRequestException(
				"The communication has no normalized external phone number.",
			);
		}

		const communicationIds = await this.db.$transaction(async (tx) => {
			await tx.contactPhone.upsert({
				where: {
					contactId_e164: { contactId: contact.id, e164: phoneE164 },
				},
				create: {
					contactId: contact.id,
					value: phoneE164,
					e164: phoneE164,
					primary: !contact.phone,
					source: "MANUAL",
					verifiedAt: new Date(),
				},
				update: { source: "MANUAL", verifiedAt: new Date() },
			});
			if (!contact.phone) {
				await tx.contact.update({
					where: { id: contact.id },
					data: { phone: phoneE164 },
				});
			}
			const unresolved = await tx.communication.findMany({
				where: {
					OR: [
						{ id: communication.id },
						{
							matchStatus: "NEEDS_REVIEW",
							participants: { some: { role: "EXTERNAL", phoneE164 } },
						},
					],
				},
				select: { id: true },
			});
			const ids = unresolved.map((item) => item.id);
			await tx.communication.updateMany({
				where: { id: { in: ids } },
				data: { matchStatus: "MATCHED" },
			});
			await tx.communicationParticipant.updateMany({
				where: {
					communicationId: { in: ids },
					role: "EXTERNAL",
					phoneE164,
				},
				data: { contactId: contact.id },
			});
			return ids;
		});

		for (const id of communicationIds) {
			await projectCommunication(this.db, id, contact.id);
		}
		return {
			resolved: communicationIds.length,
			phoneE164,
			contactId: contact.id,
		};
	}

	private where(
		input: z.infer<typeof communicationListInput>,
	): Prisma.CommunicationWhereInput {
		const where: Prisma.CommunicationWhereInput = {};
		if (input.filter === "calls") where.kind = "CALL";
		if (input.filter === "messages") where.kind = "MESSAGE";
		if (input.filter === "review") where.matchStatus = "NEEDS_REVIEW";
		if (input.q) {
			where.OR = [
				{ body: { contains: input.q, mode: "insensitive" } },
				{ status: { contains: input.q, mode: "insensitive" } },
				{
					participants: {
						some: {
							OR: [
								{ phoneE164: { contains: input.q } },
								{
									contact: {
										is: {
											OR: [
												{
													firstName: {
														contains: input.q,
														mode: "insensitive",
													},
												},
												{
													lastName: {
														contains: input.q,
														mode: "insensitive",
													},
												},
												{
													email: {
														contains: input.q,
														mode: "insensitive",
													},
												},
											],
										},
									},
								},
							],
						},
					},
				},
				{
					artifacts: {
						some: { text: { contains: input.q, mode: "insensitive" } },
					},
				},
			];
		}
		return where;
	}
}

function serializeCommunication(communication: CommunicationRow) {
	const artifacts = communication.artifacts.map((artifact) => ({
		...artifact,
		payload: parseArtifactPayload(artifact.type, artifact.payload),
		createdAt: artifact.createdAt.toISOString(),
	}));
	return {
		...communication,
		occurredAt: communication.occurredAt.toISOString(),
		completedAt: communication.completedAt?.toISOString() ?? null,
		artifacts,
		recordings: artifacts
			.filter(
				(artifact) =>
					artifact.type === "RECORDING" || artifact.type === "VOICEMAIL",
			)
			.map((artifact) => ({
				id: artifact.id,
				type: artifact.type,
				url: artifact.storedUrl ?? artifact.sourceUrl,
				durationSeconds: artifact.durationSeconds,
				transcript: artifact.type === "VOICEMAIL" ? artifact.text : null,
			}))
			.filter(
				(recording): recording is typeof recording & { url: string } =>
					recording.url !== null,
			),
		summary:
			artifacts.find((artifact) => artifact.type === "SUMMARY")?.text ?? null,
		nextSteps:
			artifacts.find((artifact) => artifact.type === "NEXT_STEPS")?.text ??
			null,
		transcript:
			artifacts.find((artifact) => artifact.type === "TRANSCRIPT")?.text ??
			null,
	};
}

function serializeCommunicationListItem(communication: CommunicationListRow) {
	const summary = communication.artifacts.find(
		(artifact) => artifact.type === "SUMMARY",
	)?.text;
	return {
		id: communication.id,
		provider: communication.provider,
		kind: communication.kind,
		direction: communication.direction,
		status: communication.status,
		body: communication.body,
		occurredAt: communication.occurredAt.toISOString(),
		durationSeconds: communication.durationSeconds,
		matchStatus: communication.matchStatus,
		createdBy: communication.createdBy,
		participants: communication.participants,
		summary: summary ?? null,
		hasRecording: communication.artifacts.some(
			(artifact) =>
				artifact.type === "RECORDING" || artifact.type === "VOICEMAIL",
		),
	};
}

function parseArtifactPayload(
	type: CommunicationRow["artifacts"][number]["type"],
	payload: Prisma.JsonValue | null,
) {
	if (payload === null) return null;
	if (type === "SUMMARY" || type === "NEXT_STEPS") {
		return z.array(z.string()).parse(payload);
	}
	if (type === "TRANSCRIPT") {
		return schemas.quo.transcriptResource.shape.dialogue.parse(payload);
	}
	if (type === "RECORDING") {
		return schemas.quo.recordingResource.shape.recordings.element.parse(
			payload,
		);
	}
	if (type === "VOICEMAIL") {
		return schemas.quo.voicemailResource.parse(payload);
	}
	return z.never().parse(type);
}
