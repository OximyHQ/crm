import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { db } from "@crm/db";
import { fileGranolaNote } from "../agent/lib/granola-note";

const PREFIX = "granola-note-spec";
const USER_ID = `${PREFIX}-user`;
const COMPANY_ID = `${PREFIX}-company`;
const CONTACT_ID = `${PREFIX}-contact`;
const DEAL_ID = `${PREFIX}-deal`;
const EVENT_ID = `${PREFIX}-event`;
const START = new Date("2026-08-12T14:00:00.000Z");

beforeEach(async () => {
	await db.activity.deleteMany({
		where: { OR: [{ companyId: COMPANY_ID }, { dealId: DEAL_ID }] },
	});
	await db.calendarEvent.deleteMany({ where: { id: EVENT_ID } });
	await db.deal.deleteMany({ where: { companyId: COMPANY_ID } });
	await db.contact.deleteMany({ where: { id: CONTACT_ID } });
	await db.company.deleteMany({ where: { id: COMPANY_ID } });
	await db.user.upsert({
		where: { id: USER_ID },
		create: {
			id: USER_ID,
			name: "Granola Owner",
			email: "owner@internal.test",
		},
		update: {},
	});
	await db.company.create({
		data: { id: COMPANY_ID, name: "Granola Customer" },
	});
	await db.contact.create({
		data: {
			id: CONTACT_ID,
			firstName: "Customer",
			lastName: "Contact",
			email: "customer@example.test",
			companyId: COMPANY_ID,
		},
	});
	await db.deal.create({
		data: {
			id: DEAL_ID,
			name: "Granola Deal",
			companyId: COMPANY_ID,
			ownerId: USER_ID,
			contacts: { create: { contactId: CONTACT_ID } },
		},
	});
	await db.calendarEvent.create({
		data: {
			id: EVENT_ID,
			iCalUid: "calendar-event-1",
			originalStartTime: START,
			title: "Customer call",
			startsAt: START,
			endsAt: new Date("2026-08-12T15:00:00.000Z"),
			status: "confirmed",
			companyId: COMPANY_ID,
			contactId: CONTACT_ID,
			syncedByUserId: USER_ID,
		},
	});
	await db.activity.create({
		data: {
			type: "MEETING",
			subject: "Customer call",
			body: "Location: Zoom",
			occurredAt: START,
			companyId: COMPANY_ID,
			contactId: CONTACT_ID,
			createdById: USER_ID,
			calendarEventId: EVENT_ID,
		},
	});
});

afterEach(async () => {
	await db.activity.deleteMany({
		where: { OR: [{ companyId: COMPANY_ID }, { dealId: DEAL_ID }] },
	});
	await db.calendarEvent.deleteMany({ where: { id: EVENT_ID } });
	await db.deal.deleteMany({ where: { companyId: COMPANY_ID } });
	await db.contact.deleteMany({ where: { id: CONTACT_ID } });
	await db.company.deleteMany({ where: { id: COMPANY_ID } });
	await db.user.deleteMany({ where: { id: USER_ID } });
});

describe("filing a Granola customer call", () => {
	it("enriches the calendar activity and links its unique open deal", async () => {
		const result = await fileGranolaNote({
			id: "not_12345678901234",
			object: "note",
			title: "Customer call",
			owner: { name: "Granola Owner", email: "owner@internal.test" },
			created_at: "2026-08-12T15:00:00.000Z",
			updated_at: "2026-08-12T15:05:00.000Z",
			web_url: "https://notes.granola.ai/d/customer-call",
			calendar_event: {
				event_title: "Customer call",
				invitees: [{ email: "customer@example.test" }],
				organiser: "owner@internal.test",
				calendar_event_id: "calendar-event-1",
				scheduled_start_time: "2026-08-12T10:00:00-04:00",
				scheduled_end_time: "2026-08-12T11:00:00-04:00",
			},
			attendees: [
				{ name: "Granola Owner", email: "owner@internal.test" },
				{ name: "Customer Contact", email: "customer@example.test" },
			],
			folder_membership: [
				{
					id: "fol_12345678901234",
					object: "folder",
					name: "Customer Calls",
					parent_folder_id: null,
				},
			],
			summary_text: "The customer approved the rollout.",
			summary_markdown: "## Outcome\n\nThe customer approved the rollout.",
			transcript: null,
		});

		expect(result).toEqual({ status: "matched", dealId: DEAL_ID });

		const activities = await db.activity.findMany({
			where: { calendarEventId: EVENT_ID },
			select: { body: true, dealId: true },
		});

		expect(activities).toEqual([
			{
				body: "## Outcome\n\nThe customer approved the rollout.",
				dealId: DEAL_ID,
			},
		]);
	});

	it("creates one meeting activity when calendar sync did not create one", async () => {
		await db.calendarEvent.delete({ where: { id: EVENT_ID } });

		const result = await fileGranolaNote({
			id: "not_abcdefghijklmn",
			object: "note",
			title: "Customer follow-up",
			owner: { name: "Granola Owner", email: "owner@internal.test" },
			created_at: "2026-08-12T15:00:00.000Z",
			updated_at: "2026-08-12T15:05:00.000Z",
			web_url: "https://notes.granola.ai/d/customer-follow-up",
			calendar_event: null,
			attendees: [
				{ name: "Granola Owner", email: "owner@internal.test" },
				{ name: "Customer Contact", email: "customer@example.test" },
			],
			folder_membership: [],
			summary_text: "The customer confirmed the next step.",
			summary_markdown: null,
			transcript: null,
		});

		expect(result).toEqual({ status: "matched", dealId: DEAL_ID });

		const activities = await db.activity.findMany({
			where: { dealId: DEAL_ID },
			select: {
				type: true,
				subject: true,
				body: true,
				companyId: true,
				contactId: true,
			},
		});

		expect(activities).toEqual([
			{
				type: "MEETING",
				subject: "Customer follow-up",
				body: "The customer confirmed the next step.",
				companyId: COMPANY_ID,
				contactId: CONTACT_ID,
			},
		]);
	});

	it("updates the same activity when Granola delivers the note again", async () => {
		await db.calendarEvent.delete({ where: { id: EVENT_ID } });

		const note = {
			id: "not_zyxwvutsrqponm",
			object: "note",
			title: "Customer follow-up",
			owner: { name: "Granola Owner", email: "owner@internal.test" },
			created_at: "2026-08-12T15:00:00.000Z",
			updated_at: "2026-08-12T15:05:00.000Z",
			web_url: "https://notes.granola.ai/d/idempotent-call",
			calendar_event: null,
			attendees: [
				{ name: "Granola Owner", email: "owner@internal.test" },
				{ name: "Customer Contact", email: "customer@example.test" },
			],
			folder_membership: [],
			summary_text: "First summary.",
			summary_markdown: null,
		};

		await fileGranolaNote(note);
		await fileGranolaNote({
			...note,
			updated_at: "2026-08-12T15:10:00.000Z",
			summary_text: "Updated summary.",
		});

		const activities = await db.activity.findMany({
			where: { dealId: DEAL_ID },
			select: { body: true },
		});

		expect(activities).toEqual([
			{
				body: "Updated summary.",
			},
		]);
	});

	it("files an unassigned company activity when two open deals match", async () => {
		await db.calendarEvent.delete({ where: { id: EVENT_ID } });
		await db.deal.create({
			data: {
				id: `${PREFIX}-second-deal`,
				name: "Second Granola Deal",
				companyId: COMPANY_ID,
				ownerId: USER_ID,
				contacts: { create: { contactId: CONTACT_ID } },
			},
		});

		const result = await fileGranolaNote({
			id: "not_reviewneeded12",
			object: "note",
			title: "Ambiguous customer call",
			owner: { name: "Granola Owner", email: "owner@internal.test" },
			created_at: "2026-08-12T15:00:00.000Z",
			updated_at: "2026-08-12T15:05:00.000Z",
			web_url: "https://notes.granola.ai/d/ambiguous-call",
			calendar_event: null,
			attendees: [
				{ name: "Granola Owner", email: "owner@internal.test" },
				{ name: "Customer Contact", email: "customer@example.test" },
			],
			folder_membership: [],
			summary_text: "Two open deals match this customer.",
			summary_markdown: null,
			transcript: null,
		});

		expect(result).toEqual({ status: "needs_review" });
		expect(
			await db.activity.findUnique({
				where: { granolaNoteId: "not_reviewneeded12" },
				select: { companyId: true, dealId: true, granolaMatchStatus: true },
			}),
		).toEqual({
			companyId: COMPANY_ID,
			dealId: null,
			granolaMatchStatus: "needs_review",
		});
	});
});
