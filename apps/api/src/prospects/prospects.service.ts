import type { Db, ProspectStatus } from "@crm/db";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { AgentTriggerService } from "../agent/agent-trigger.service";
import { InjectDatabase } from "../database/database.constants";
import {
	type ProspectProfile,
	parseProspectProfile,
} from "./prospects.contracts";

export type ProspectRow = {
	id: string;
	personId: string;
	fullName: string;
	title: string;
	headline: string | null;
	city: string | null;
	state: string | null;
	country: string | null;
	linkedinUrl: string | null;
	connectionsCount: number;
	followerCount: number;
	tier: number;
	orgFunction: string;
	seniorityRank: number;
	reportsToPersonId: string | null;
	profileAsOf: string | null;
	status: ProspectStatus;
	contactId: string | null;
	updatedAt: string;
};

@Injectable()
export class ProspectsService {
	private readonly logger = new Logger(ProspectsService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly agent: AgentTriggerService,
	) {}

	async list(companyId: string): Promise<ProspectRow[]> {
		const rows = await this.db.companyProspect.findMany({
			where: { companyId },
			orderBy: [
				{ seniorityRank: "asc" },
				{ tier: "asc" },
				{ connectionsCount: "desc" },
				{ fullName: "asc" },
			],
		});

		return rows.map((row) => ({
			id: row.id,
			personId: row.personId,
			fullName: row.fullName,
			title: row.title,
			headline: row.headline,
			city: row.city,
			state: row.state,
			country: row.country,
			linkedinUrl: row.linkedinUrl,
			connectionsCount: row.connectionsCount,
			followerCount: row.followerCount,
			tier: row.tier,
			orgFunction: row.orgFunction,
			seniorityRank: row.seniorityRank,
			reportsToPersonId: row.reportsToPersonId,
			profileAsOf: row.profileAsOf?.toISOString() ?? null,
			status: effectiveStatus(row),
			contactId: row.contactId,
			updatedAt: row.updatedAt.toISOString(),
		}));
	}

	async byId(
		id: string,
	): Promise<ProspectRow & { profile: ProspectProfile | null }> {
		const row = await this.db.companyProspect.findUnique({ where: { id } });
		if (!row) throw new NotFoundException(`No prospect with id ${id}.`);

		return {
			id: row.id,
			personId: row.personId,
			fullName: row.fullName,
			title: row.title,
			headline: row.headline,
			city: row.city,
			state: row.state,
			country: row.country,
			linkedinUrl: row.linkedinUrl,
			connectionsCount: row.connectionsCount,
			followerCount: row.followerCount,
			tier: row.tier,
			orgFunction: row.orgFunction,
			seniorityRank: row.seniorityRank,
			reportsToPersonId: row.reportsToPersonId,
			profileAsOf: row.profileAsOf?.toISOString() ?? null,
			status: effectiveStatus(row),
			contactId: row.contactId,
			updatedAt: row.updatedAt.toISOString(),
			profile: parseProspectProfile(row.profile),
		};
	}

	async addAsContact(
		id: string,
	): Promise<{ contactId: string; linked: boolean }> {
		const prospect = await this.db.companyProspect.findUnique({
			where: { id },
			include: { company: { select: { ownerId: true } } },
		});

		if (!prospect) {
			throw new NotFoundException(`No prospect with id ${id}.`);
		}

		if (prospect.contactId) {
			return { contactId: prospect.contactId, linked: true };
		}

		const existingId = await this.matchExistingContact(
			prospect.companyId,
			prospect.linkedinUrl,
			prospect.fullName,
		);
		if (existingId) {
			await this.db.companyProspect.update({
				where: { id },
				data: { status: "ADDED", contactId: existingId },
			});
			return { contactId: existingId, linked: true };
		}

		const name = splitName(prospect.fullName);
		const contact = await this.agent.withCrmEvents(async (tx, emit) => {
			const created = await tx.contact.create({
				data: {
					firstName: name.firstName,
					lastName: name.lastName,
					title: prospect.title,
					linkedinUrl: prospect.linkedinUrl,
					companyId: prospect.companyId,
					ownerId: prospect.company.ownerId,
					source: "PROSPECTING",
				},
				select: {
					id: true,
					firstName: true,
					lastName: true,
					email: true,
					companyId: true,
					createdAt: true,
				},
			});
			await emit({
				type: "contact.created",
				record: { kind: "contact", id: created.id },
				occurredAt: created.createdAt,
				data: {
					firstName: created.firstName,
					lastName: created.lastName,
					email: created.email,
					companyId: created.companyId,
				},
			});
			await tx.companyProspect.update({
				where: { id },
				data: { status: "ADDED", contactId: created.id },
			});
			return created;
		});

		await this.agent.contactCreated(contact.id, "Promoted from the People tab");

		this.logger.log({
			message: "Prospect added as contact",
			prospectId: id,
			contactId: contact.id,
		});

		return { contactId: contact.id, linked: false };
	}

	async dismiss(id: string): Promise<{ id: string; status: ProspectStatus }> {
		const { count } = await this.db.companyProspect.updateMany({
			where: { id, status: "SUGGESTED" },
			data: { status: "DISMISSED" },
		});

		if (count === 0) {
			const row = await this.db.companyProspect.findUnique({
				where: { id },
				select: { status: true },
			});
			if (!row) throw new NotFoundException(`No prospect with id ${id}.`);
			return { id, status: row.status };
		}

		return { id, status: "DISMISSED" };
	}

	async restore(id: string): Promise<{ id: string; status: ProspectStatus }> {
		const { count } = await this.db.companyProspect.updateMany({
			where: { id, status: "DISMISSED" },
			data: { status: "SUGGESTED" },
		});

		if (count === 0) {
			const row = await this.db.companyProspect.findUnique({
				where: { id },
				select: { status: true },
			});
			if (!row) throw new NotFoundException(`No prospect with id ${id}.`);
			return { id, status: row.status };
		}

		return { id, status: "SUGGESTED" };
	}

	async status(
		companyId: string,
	): Promise<{ running: boolean; lastOutcome: string | null }> {
		const [open, finished] = await Promise.all([
			this.db.agentTask.findFirst({
				where: { kind: "gtm-people", companyId, finishedAt: null },
				select: { id: true },
			}),
			this.db.agentTask.findFirst({
				where: { kind: "gtm-people", companyId, finishedAt: { not: null } },
				orderBy: { finishedAt: "desc" },
				select: { outcome: true },
			}),
		]);

		return { running: open !== null, lastOutcome: finished?.outcome ?? null };
	}

	async refresh(companyId: string): Promise<{ queued: boolean }> {
		const company = await this.db.company.findUnique({
			where: { id: companyId },
			select: { id: true },
		});

		if (!company) {
			throw new NotFoundException(`No company with id ${companyId}.`);
		}

		await this.agent.gtmPeopleRequested(
			companyId,
			"A rep asked for a fresh people pull",
		);

		return { queued: true };
	}

	private async matchExistingContact(
		companyId: string,
		linkedinUrl: string | null,
		fullName: string,
	): Promise<string | null> {
		const contacts = await this.db.contact.findMany({
			where: { companyId },
			select: {
				id: true,
				linkedinUrl: true,
				firstName: true,
				lastName: true,
			},
		});

		const canonical = canonicalLinkedIn(linkedinUrl);
		if (canonical) {
			const byUrl = contacts.find(
				(contact) => canonicalLinkedIn(contact.linkedinUrl) === canonical,
			);
			if (byUrl) return byUrl.id;
		}

		const wanted = normalizeName(fullName);
		if (!wanted) return null;
		return (
			contacts.find(
				(contact) =>
					normalizeName(
						[contact.firstName, contact.lastName].filter(Boolean).join(" "),
					) === wanted,
			)?.id ?? null
		);
	}
}

function effectiveStatus(row: {
	status: ProspectStatus;
	contactId: string | null;
}): ProspectStatus {
	return row.status === "ADDED" && !row.contactId ? "SUGGESTED" : row.status;
}

function normalizeName(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z ]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function splitName(fullName: string): {
	firstName: string;
	lastName: string | null;
} {
	const parts = fullName.trim().split(/\s+/).filter(Boolean);
	const [firstName, ...rest] = parts;
	if (!firstName) return { firstName: fullName.trim(), lastName: null };
	return { firstName, lastName: rest.length > 0 ? rest.join(" ") : null };
}

function canonicalLinkedIn(value: string | null | undefined): string | null {
	if (!value) return null;
	try {
		const url = new URL(value);
		const host = url.hostname.toLowerCase().replace(/^www\./, "");
		if (host !== "linkedin.com" && !host.endsWith(".linkedin.com")) {
			return null;
		}
		return `linkedin.com${url.pathname.replace(/\/+$/, "").toLowerCase()}`;
	} catch {
		return null;
	}
}
