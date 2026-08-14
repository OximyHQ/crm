import { ActivityType, db, EnrichmentStatus, RecordSource } from "@crm/db";
import { lockIdempotencyKey } from "@crm/db/idempotency";
import type { EvidenceKind } from "./evidence";
import { recordFact } from "./facts";
import { namesMatch, splitName } from "./names";
import { identity } from "./workspace";

export type ProspectCandidate = {
	name: string;
	title: string;
	relevance: string;
	sourceUrl: string;
	linkedinUrl?: string;
};

export type ProspectingResult = {
	created: { id: string; name: string }[];
	existing: { id: string; name: string }[];
	skipped: { name: string; reason: string }[];
	targetCustomer: string | null;
	reason?: string;
};

type Company = {
	id: string;
	name: string;
	domain: string | null;
	website: string | null;
	ownerId: string | null;
};

type ProspectTarget = {
	id: string;
	candidate: ProspectCandidate;
	evidenceKind: EvidenceKind;
	created: boolean;
};

type ProspectingDependencies = {
	readIdentity: () => ReturnType<typeof identity>;
};

const PROSPECTING_DEPENDENCIES: ProspectingDependencies = {
	readIdentity: identity,
};

export async function addProspects(
	input: {
		companyId: string;
		companyFit: string;
		companyFitSourceUrl: string;
		candidates: ProspectCandidate[];
	},
	dependencies: ProspectingDependencies = PROSPECTING_DEPENDENCIES,
): Promise<ProspectingResult> {
	const [us, company] = await Promise.all([
		dependencies.readIdentity(),
		db.company.findUnique({
			where: { id: input.companyId },
			select: {
				id: true,
				name: true,
				domain: true,
				website: true,
				ownerId: true,
			},
		}),
	]);

	const targetCustomer = us?.profile?.sections.sellsTo?.trim() ?? null;
	if (!targetCustomer) {
		return {
			created: [],
			existing: [],
			skipped: [],
			targetCustomer,
			reason:
				"Our workspace profile has no target customer. No prospects were added.",
		};
	}

	if (!company) {
		return {
			created: [],
			existing: [],
			skipped: [],
			targetCustomer,
			reason: "No such company.",
		};
	}

	if (!httpsUrl(input.companyFitSourceUrl)) {
		return {
			created: [],
			existing: [],
			skipped: [],
			targetCustomer,
			reason: "The company fit needs a public HTTPS source.",
		};
	}

	const authorId =
		company.ownerId ??
		(
			await db.user.findFirst({
				orderBy: { createdAt: "asc" },
				select: { id: true },
			})
		)?.id ??
		null;

	if (!authorId) {
		return {
			created: [],
			existing: [],
			skipped: [],
			targetCustomer,
			reason: "No CRM user exists to own prospecting evidence.",
		};
	}

	const accepted: {
		candidate: ProspectCandidate;
		evidenceKind: EvidenceKind;
	}[] = [];
	const skipped: ProspectingResult["skipped"] = [];

	for (const candidate of input.candidates) {
		const parsedName = splitName(candidate.name);
		if (!parsedName) {
			skipped.push({ name: candidate.name, reason: "The name is empty." });
			continue;
		}

		const evidenceKind = prospectEvidence(candidate.sourceUrl, company);
		if (!evidenceKind) {
			skipped.push({
				name: candidate.name,
				reason:
					"Use the employer's site or the person's LinkedIn profile as the source.",
			});
			continue;
		}

		if (candidate.linkedinUrl && !linkedInProfile(candidate.linkedinUrl)) {
			skipped.push({
				name: candidate.name,
				reason: "The LinkedIn URL is not a personal profile.",
			});
			continue;
		}

		accepted.push({ candidate, evidenceKind });
	}

	const targets = await db.$transaction(async (tx) => {
		await lockIdempotencyKey(tx, `prospecting:${company.id}`);

		const existingContacts = await tx.contact.findMany({
			where: { companyId: company.id },
			select: {
				id: true,
				firstName: true,
				lastName: true,
				linkedinUrl: true,
				source: true,
			},
		});
		const rows: ProspectTarget[] = [];

		for (const item of accepted) {
			const candidateProfile = canonicalUrl(item.candidate.linkedinUrl);
			const match = existingContacts.find((contact) => {
				const fullName = [contact.firstName, contact.lastName]
					.filter(Boolean)
					.join(" ");
				return (
					(candidateProfile !== null &&
						candidateProfile === canonicalUrl(contact.linkedinUrl)) ||
					namesMatch(item.candidate.name, fullName)
				);
			});

			if (match) {
				if (match.source === RecordSource.PROSPECTING) {
					rows.push({
						id: match.id,
						candidate: item.candidate,
						evidenceKind: item.evidenceKind,
						created: false,
					});
				} else {
					skipped.push({
						name: item.candidate.name,
						reason: "This person is already in the CRM.",
					});
				}
				continue;
			}

			const name = splitName(item.candidate.name);
			if (!name) continue;
			const now = new Date();
			const contact = await tx.contact.create({
				data: {
					...name,
					companyId: company.id,
					ownerId: company.ownerId,
					source: RecordSource.PROSPECTING,
					enrichmentStatus: EnrichmentStatus.COMPLETE,
					enrichedAt: now,
				},
				select: {
					id: true,
					firstName: true,
					lastName: true,
					linkedinUrl: true,
					source: true,
				},
			});

			await tx.activity.create({
				data: {
					type: ActivityType.ENRICHMENT,
					subject: "Prospect discovered",
					body: item.candidate.relevance,
					occurredAt: now,
					companyId: company.id,
					contactId: contact.id,
					createdById: authorId,
					meta: {
						source: "public-web",
						sourceUrl: item.candidate.sourceUrl,
						companyFit: input.companyFit,
						companyFitSourceUrl: input.companyFitSourceUrl,
						targetCustomer,
						agent: "people-research",
					},
				},
			});

			existingContacts.push(contact);
			rows.push({
				id: contact.id,
				candidate: item.candidate,
				evidenceKind: item.evidenceKind,
				created: true,
			});
		}

		return rows;
	});

	for (const target of targets) {
		const evidence = [
			{
				kind: target.evidenceKind,
				detail: `${target.candidate.name} is ${target.candidate.title} at ${company.name}.`,
				sourceUrl: target.candidate.sourceUrl,
			},
		];

		await recordFact({
			contactId: target.id,
			field: "name",
			value: target.candidate.name,
			evidence,
			method:
				target.evidenceKind === "company.team-page"
					? "company.team-page"
					: "linkedin.profile",
			sourceUrl: target.candidate.sourceUrl,
		});
		await recordFact({
			contactId: target.id,
			field: "title",
			value: target.candidate.title,
			evidence,
			method:
				target.evidenceKind === "company.team-page"
					? "company.team-page"
					: "linkedin.profile",
			sourceUrl: target.candidate.sourceUrl,
		});

		if (target.candidate.linkedinUrl) {
			await recordFact({
				contactId: target.id,
				field: "linkedinUrl",
				value: target.candidate.linkedinUrl,
				evidence,
				method: "linkedin.profile",
				sourceUrl: target.candidate.sourceUrl,
			});
		}
	}

	return {
		created: targets
			.filter((target) => target.created)
			.map((target) => ({ id: target.id, name: target.candidate.name })),
		existing: targets
			.filter((target) => !target.created)
			.map((target) => ({ id: target.id, name: target.candidate.name })),
		skipped,
		targetCustomer,
	};
}

export function prospectEvidence(
	sourceUrl: string,
	company: Pick<Company, "domain" | "website">,
): EvidenceKind | null {
	const url = parsedHttpsUrl(sourceUrl);
	if (!url) return null;
	if (linkedInProfile(sourceUrl)) return "linkedin.employer-and-name";

	const hosts = [company.domain, company.website]
		.map(canonicalHost)
		.filter((host): host is string => host !== null);

	return hosts.some(
		(host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
	)
		? "company.team-page"
		: null;
}

function linkedInProfile(value: string): boolean {
	const url = parsedHttpsUrl(value);
	return Boolean(
		url &&
			(url.hostname === "linkedin.com" ||
				url.hostname.endsWith(".linkedin.com")) &&
			url.pathname.startsWith("/in/"),
	);
}

function canonicalUrl(value: string | null | undefined): string | null {
	const url = parsedHttpsUrl(value);
	if (!url) return null;
	return `${url.hostname}${url.pathname.replace(/\/+$/, "")}`.toLowerCase();
}

function canonicalHost(value: string | null | undefined): string | null {
	const trimmed = value?.trim();
	if (!trimmed) return null;
	const url = parsedHttpsUrl(
		/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
	);
	return url?.hostname ?? null;
}

function httpsUrl(value: string): boolean {
	return parsedHttpsUrl(value) !== null;
}

function parsedHttpsUrl(value: string | null | undefined): URL | null {
	if (!value) return null;
	try {
		const url = new URL(value);
		if (url.protocol !== "https:") return null;
		url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
		return url;
	} catch {
		return null;
	}
}
