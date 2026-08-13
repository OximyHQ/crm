import { DealStage, db } from "@crm/db";
import { z } from "zod";

const granolaPerson = z.object({
	name: z.string().nullable().optional(),
	email: z.string().email(),
});

export const granolaNote = z.object({
	id: z.string().regex(/^not_[a-zA-Z0-9]{14}$/),
	object: z.literal("note"),
	title: z.string().nullable(),
	owner: granolaPerson,
	created_at: z.iso.datetime(),
	updated_at: z.iso.datetime(),
	web_url: z.url(),
	calendar_event: z
		.object({
			event_title: z.string().nullable(),
			invitees: z.array(z.object({ email: z.string().email() })),
			organiser: z.string().email().nullable(),
			calendar_event_id: z.string().nullable(),
			scheduled_start_time: z.iso.datetime(),
			scheduled_end_time: z.iso.datetime(),
		})
		.nullable(),
	attendees: z.array(granolaPerson),
	folder_membership: z.array(
		z.object({
			id: z.string(),
			object: z.literal("folder"),
			name: z.string(),
			parent_folder_id: z.string().nullable(),
		}),
	),
	summary_text: z.string(),
	summary_markdown: z.string().nullable(),
});

export type GranolaNote = z.infer<typeof granolaNote>;

export type GranolaFilingResult =
	| { status: "matched"; dealId: string }
	| { status: "needs_review" }
	| { status: "unmatched" };

const CLOSED_STAGES = [DealStage.CLOSED_WON, DealStage.CLOSED_LOST];

export async function fileGranolaNote(
	value: unknown,
): Promise<GranolaFilingResult> {
	const note = granolaNote.parse(value);
	const calendar = note.calendar_event;
	const calendarEvent = calendar?.calendar_event_id
		? await db.calendarEvent.findFirst({
				where: {
					OR: [
						{ iCalUid: calendar.calendar_event_id },
						{ googleEventId: calendar.calendar_event_id },
					],
				},
				select: {
					id: true,
					companyId: true,
					contactId: true,
					syncedByUserId: true,
				},
			})
		: null;

	const attendeeEmails = note.attendees.map((attendee) =>
		attendee.email.toLowerCase(),
	);
	const contacts = await db.contact.findMany({
		where: { email: { in: attendeeEmails, mode: "insensitive" } },
		select: { id: true, companyId: true },
	});
	const contactIds = new Set(contacts.map((contact) => contact.id));
	if (calendarEvent?.contactId) contactIds.add(calendarEvent.contactId);

	const companies = new Set(
		contacts.flatMap((contact) =>
			contact.companyId ? [contact.companyId] : [],
		),
	);
	if (calendarEvent?.companyId) companies.add(calendarEvent.companyId);
	const companyId = companies.size === 1 ? [...companies][0] : null;

	const contactDeals =
		contactIds.size > 0
			? await db.deal.findMany({
					where: {
						stage: { notIn: CLOSED_STAGES },
						contacts: { some: { contactId: { in: [...contactIds] } } },
					},
					select: { id: true, ownerId: true },
					take: 2,
				})
			: [];
	const companyDeals =
		contactDeals.length === 0 && companyId
			? await db.deal.findMany({
					where: { companyId, stage: { notIn: CLOSED_STAGES } },
					select: { id: true, ownerId: true },
					take: 2,
				})
			: [];
	const candidates = contactDeals.length > 0 ? contactDeals : companyDeals;
	const candidateDealId = candidates.length === 1 ? candidates[0]?.id : null;

	const body = note.summary_markdown || note.summary_text;

	const existingActivity = await db.activity.findFirst({
		where: {
			OR: [
				{ granolaNoteId: note.id },
				...(calendarEvent ? [{ calendarEventId: calendarEvent.id }] : []),
			],
		},
		select: { id: true, dealId: true },
	});
	const dealId = existingActivity?.dealId ?? candidateDealId;
	const matchStatus = dealId
		? "matched"
		: candidates.length > 1
			? "needs_review"
			: "unmatched";

	if (existingActivity) {
		await db.activity.update({
			where: { id: existingActivity.id },
			data: {
				body,
				dealId,
				granolaNoteId: note.id,
				granolaUrl: note.web_url,
				granolaMatchStatus: matchStatus,
			},
		});
	} else if (companyId) {
		const author = await db.user.findFirst({
			where: { email: { equals: note.owner.email, mode: "insensitive" } },
			select: { id: true },
		});
		const contactId = contactIds.size === 1 ? [...contactIds][0] : null;
		const occurredAt = calendar
			? new Date(calendar.scheduled_start_time)
			: new Date(note.created_at);
		const ownerIds = new Set(candidates.map((candidate) => candidate.ownerId));
		const candidateOwnerId = ownerIds.size === 1 ? [...ownerIds][0] : null;
		const createdById =
			author?.id ?? calendarEvent?.syncedByUserId ?? candidateOwnerId;
		if (!createdById) return { status: "unmatched" };

		await db.activity.create({
			data: {
				type: "MEETING",
				subject: note.title,
				body,
				occurredAt,
				companyId,
				contactId,
				dealId,
				createdById,
				granolaNoteId: note.id,
				granolaUrl: note.web_url,
				granolaMatchStatus: matchStatus,
			},
		});
	}

	if (dealId) return { status: "matched", dealId };
	if (candidates.length > 1) return { status: "needs_review" };
	return { status: "unmatched" };
}
