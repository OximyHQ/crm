import type { Db } from "./client";
import type { Prisma } from "./generated/prisma/client";
import type {
	CommunicationDirection,
	CommunicationKind,
} from "./generated/prisma/enums";

export async function projectCommunication(
	db: Db,
	communicationId: string,
	contactId: string,
): Promise<string> {
	return db.$transaction(async (tx) => {
		const communication = await tx.communication.findUniqueOrThrow({
			where: { id: communicationId },
			select: {
				kind: true,
				direction: true,
				body: true,
				occurredAt: true,
				createdById: true,
				artifacts: {
					where: { type: "SUMMARY" },
					select: { text: true },
					take: 1,
				},
			},
		});
		const contact = await tx.contact.findUniqueOrThrow({
			where: { id: contactId },
			select: { companyId: true },
		});
		const createdById =
			communication.createdById ?? (await workspaceOwnerId(tx));
		const activity = await tx.activity.upsert({
			where: { communicationId },
			create: {
				type: communication.kind,
				subject: communicationSubject(
					communication.kind,
					communication.direction,
				),
				body: communication.artifacts[0]?.text ?? communication.body,
				occurredAt: communication.occurredAt,
				createdById,
				contactId,
				companyId: contact.companyId,
				communicationId,
			},
			update: {
				type: communication.kind,
				subject: communicationSubject(
					communication.kind,
					communication.direction,
				),
				body: communication.artifacts[0]?.text ?? communication.body,
				occurredAt: communication.occurredAt,
				createdById,
				contactId,
				companyId: contact.companyId,
			},
			select: { id: true },
		});
		await tx.contact.updateMany({
			where: {
				id: contactId,
				OR: [
					{ lastActivityAt: null },
					{ lastActivityAt: { lt: communication.occurredAt } },
				],
			},
			data: { lastActivityAt: communication.occurredAt },
		});
		if (contact.companyId) {
			await tx.company.updateMany({
				where: {
					id: contact.companyId,
					OR: [
						{ lastActivityAt: null },
						{ lastActivityAt: { lt: communication.occurredAt } },
					],
				},
				data: { lastActivityAt: communication.occurredAt },
			});
		}
		return activity.id;
	});
}

function communicationSubject(
	kind: CommunicationKind,
	direction: CommunicationDirection | null,
): string {
	const prefix =
		direction === "INBOUND"
			? "Incoming "
			: direction === "OUTBOUND"
				? "Outgoing "
				: "";
	return `${prefix}${kind === "CALL" ? "call" : "message"}`;
}

async function workspaceOwnerId(db: Prisma.TransactionClient): Promise<string> {
	const member = await db.member.findFirst({
		where: { role: { in: ["owner", "admin"] } },
		orderBy: { createdAt: "asc" },
		select: { userId: true },
	});
	if (!member) throw new Error("The CRM has no owner for the communication.");
	return member.userId;
}
