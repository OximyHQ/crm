import { db, type Prisma } from "@crm/db";
import {
	GTM_LEADER_MAX_RANK,
	GTM_PIPELINE,
	GTM_UNMATCHED_RANK,
} from "./gtm-config";
import { buildCoarseRankSql, matchTitle } from "./gtm-matcher";
import { analyzeOrg, gtmOrganizeConfigured } from "./gtm-organize";
import { type ExperienceRow, hydrateProfiles } from "./gtm-profile";
import {
	dedupeByName,
	departedPerProfile,
	type GtmPeopleResult,
	nameCandidates,
	type PersonProfile,
	type ProfileExperience,
	parseCrawlDate,
} from "./gtm-report";
import { resolveEntities } from "./gtm-resolve";
import { gtmVerifyConfigured, verifyStillAtCompany } from "./gtm-verify";
import {
	linkedinClickHouseConfigured,
	linkedinQuery,
} from "./linkedin-clickhouse";

export { type GtmPeopleResult, gtmPeopleOutcome } from "./gtm-report";

type RosterRow = {
	profile_id: string | number;
	title: string;
	company_name: string;
	tier: string | number;
};

const NONE: Omit<GtmPeopleResult, "reason"> = {
	saved: 0,
	tier1: 0,
	tier2: 0,
	entities: 0,
	truncated: false,
};

type PhaseReporter = (phase: string) => Promise<void>;

const SILENT: PhaseReporter = async () => {};

export async function runGtmPeople({
	companyId,
	onPhase = SILENT,
}: {
	companyId: string;
	onPhase?: PhaseReporter;
}): Promise<GtmPeopleResult> {
	const company = await db.company.findUnique({
		where: { id: companyId },
		select: { id: true, name: true, domain: true },
	});

	if (!company) return { ...NONE, reason: "No such company." };

	if (!linkedinClickHouseConfigured()) {
		return {
			...NONE,
			reason:
				"The LinkedIn dataset is not configured on this install, so there is nowhere to look.",
		};
	}

	const candidates = nameCandidates(company.name, company.domain);
	if (candidates.length === 0) {
		return { ...NONE, reason: "The company has no usable name to resolve." };
	}

	await onPhase("Resolving the company in the LinkedIn index");
	const resolution = await resolveEntities(candidates);
	const entities = resolution.entities;
	if (entities.length === 0) {
		return {
			...NONE,
			reason: `No LinkedIn company matched "${company.name}". Fix the company name or domain and refresh.`,
		};
	}

	await onPhase(
		`Resolved ${entities.length} LinkedIn ${
			entities.length === 1 ? "entity" : "entities"
		}, scanning the roster`,
	);
	const roster = await fetchRoster(entities.map((entity) => entity.id));
	const coarseTruncated = roster.length >= GTM_PIPELINE.roster.coarseLimit;

	const organizing = gtmOrganizeConfigured();
	const coarse = new Map<
		string,
		{ personId: string; title: string; coarseTier: number }
	>();
	for (const row of roster) {
		const personId = String(row.profile_id);
		const coarseTier = Number(row.tier) || GTM_UNMATCHED_RANK;
		const existing = coarse.get(personId);
		if (existing && existing.coarseTier <= coarseTier) continue;
		coarse.set(personId, { personId, title: row.title, coarseTier });
	}

	let candidateRows = [...coarse.values()];
	if (!organizing) {
		candidateRows = candidateRows.filter((row) => matchTitle(row.title));
	}
	candidateRows.sort(
		(a, b) =>
			a.coarseTier - b.coarseTier || a.personId.localeCompare(b.personId),
	);
	const capped = candidateRows.slice(0, GTM_PIPELINE.keep.limit);
	const truncated = coarseTruncated || candidateRows.length > capped.length;

	await onPhase(
		`Found ${capped.length} leadership candidates, reading profiles`,
	);
	const profiles = await hydrateProfiles(capped.map((row) => row.personId));

	if (capped.length > 0 && profiles.size === 0) {
		return {
			...NONE,
			entities: entities.length,
			resolvedFuzzily: resolution.fuzzy,
			reason: `Matched ${capped.length} titles, but none of the profiles could be read. Nothing was changed.`,
		};
	}

	const entityNames = entities.map((entity) => entity.name);
	const entityIds = entities.map((entity) => entity.id);
	const hydrated = capped.flatMap((row) => {
		const profile = profiles.get(row.personId);
		if (!profile?.full_name) return [];
		const experiences = toExperiences(profile.experience);
		return [
			{
				...row,
				profile,
				experiences,
				fullName: profile.full_name,
				asOf: parseCrawlDate(profile.updated_at),
				left: departedPerProfile(experiences, entityNames, entityIds),
			},
		];
	});
	const unique = dedupeByName(hydrated).kept;
	let departed = 0;
	let present = unique.filter((row) => {
		if (row.left) {
			departed += 1;
			return false;
		}
		return true;
	});

	const reportsTo = new Map<string, string | null>();
	const classified = new Map<
		string,
		{ tier: number; orgFunction: string; seniorityRank: number }
	>();

	if (organizing && present.length > 1) {
		await onPhase(
			`Judging ${present.length} candidates and inferring the hierarchy with AI`,
		);
		const analysis = await analyzeOrg(
			company.name,
			present.map((row) => ({
				personId: row.personId,
				fullName: row.fullName,
				title: row.title,
			})),
		);
		if (analysis) {
			const filtered = present.filter((row) => {
				const entry = analysis.get(row.personId);
				if (!entry) return true;
				if (!entry.keep) return false;
				reportsTo.set(row.personId, entry.reportsTo);
				classified.set(row.personId, {
					tier: entry.seniorityRank <= GTM_LEADER_MAX_RANK ? 1 : 2,
					orgFunction: entry.orgFunction,
					seniorityRank: entry.seniorityRank,
				});
				return true;
			});
			if (filtered.length === 0) {
				console.error(
					"[agent] the org analysis dropped every candidate; ignoring it",
				);
				reportsTo.clear();
				classified.clear();
			} else {
				present = filtered;
			}
		}
	}

	const people = present.flatMap((row) => {
		const shape = classified.get(row.personId) ?? matchTitle(row.title);
		if (!shape) return [];
		const asOf = row.asOf;
		const stored: PersonProfile = {
			headline: row.profile.headline || null,
			asOf: asOf?.toISOString() ?? null,
			experiences: row.experiences.slice(
				0,
				GTM_PIPELINE.profile.experienceLimit,
			),
		};
		return [
			{
				personId: row.personId,
				fullName: row.profile.full_name,
				title: row.title,
				headline: row.profile.headline || null,
				city: row.profile.city || null,
				state: row.profile.state || null,
				country: row.profile.country || null,
				linkedinUrl: row.profile.profile_url || null,
				connectionsCount: Number(row.profile.connections_count) || 0,
				followerCount: Number(row.profile.follower_count) || 0,
				tier: shape.tier,
				orgFunction: shape.orgFunction,
				seniorityRank: shape.seniorityRank,
				reportsToPersonId: reportsTo.get(row.personId) ?? null,
				profile: stored as unknown as Prisma.InputJsonValue,
				profileAsOf: asOf,
			},
		];
	});

	let verifiedOut = 0;
	let toSave = people;
	if (gtmVerifyConfigured() && people.length > 0) {
		await onPhase(
			`Checking on the web that ${Math.min(people.length, GTM_PIPELINE.verify.cap)} people are still there`,
		);
		const outcomes = await verifyStillAtCompany(
			company.name,
			people.map((person) => ({
				personId: person.personId,
				fullName: person.fullName,
				title: person.title,
			})),
		);
		toSave = people.filter(
			(person) => outcomes.get(person.personId) !== "left",
		);
		verifiedOut = people.length - toSave.length;
	}

	await onPhase("Saving the people");
	const saved = await savePeople(companyId, toSave);

	return {
		saved,
		tier1: toSave.filter((person) => person.tier === 1).length,
		tier2: toSave.filter((person) => person.tier === 2).length,
		entities: entities.length,
		truncated,
		departed,
		verifiedOut,
		resolvedFuzzily: resolution.fuzzy,
	};
}

function toExperiences(rows: ExperienceRow[] | undefined): ProfileExperience[] {
	if (!Array.isArray(rows)) return [];
	return rows
		.filter((row) => row.title || row.company_name)
		.map((row) => ({
			title: String(row.title ?? ""),
			company: String(row.company_name ?? ""),
			companyId:
				row.company_id && Number(row.company_id) > 0
					? String(row.company_id)
					: null,
			from: row.date_from ? String(row.date_from) : null,
			to: row.date_to ? String(row.date_to) : null,
			current: Number(row.is_current) === 1,
		}));
}

async function fetchRoster(entityIds: string[]): Promise<RosterRow[]> {
	const rankExpr = buildCoarseRankSql("title");
	return linkedinQuery<RosterRow>(
		`SELECT profile_id, title, company_name, tier
		 FROM (
			SELECT profile_id, title, company_name, ${rankExpr} AS tier
			FROM profile_company_lookup
			WHERE company_id IN ({ro_ids:Array(UInt64)}) AND is_current = 1
		 )
		 WHERE tier <= {ro_rank:UInt8}
		 ORDER BY tier ASC, profile_id ASC
		 LIMIT {ro_limit:UInt32}`,
		{
			ro_ids: entityIds.map(Number),
			ro_limit: GTM_PIPELINE.roster.coarseLimit,
			ro_rank: GTM_PIPELINE.roster.maxRank,
		},
		{
			stage: "roster scan",
			actionableErrors: true,
			maxExecutionSeconds: GTM_PIPELINE.roster.maxExecutionSeconds,
			retryTimeouts: false,
		},
	);
}

type PersonUpsert = {
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
	profile: Prisma.InputJsonValue;
	profileAsOf: Date | null;
};

async function savePeople(
	companyId: string,
	people: PersonUpsert[],
): Promise<number> {
	if (people.length === 0) return 0;

	const existing = await db.companyPerson.findMany({
		where: { companyId },
		select: { personId: true },
	});
	const known = new Set(existing.map((row) => row.personId));

	const fresh = people.filter((person) => !known.has(person.personId));
	const stale = people.filter((person) => known.has(person.personId));

	if (fresh.length > 0) {
		await db.companyPerson.createMany({
			data: fresh.map((person) => ({ companyId, ...person })),
			skipDuplicates: true,
		});
	}

	const chunkSize = GTM_PIPELINE.save.updateChunk;
	for (let start = 0; start < stale.length; start += chunkSize) {
		const chunk = stale.slice(start, start + chunkSize);
		await Promise.all(
			chunk.map(({ personId, ...data }) =>
				db.companyPerson.update({
					where: { companyId_personId: { companyId, personId } },
					data,
				}),
			),
		);
	}

	await db.companyPerson.deleteMany({
		where: {
			companyId,
			status: "SUGGESTED",
			personId: { notIn: people.map((person) => person.personId) },
		},
	});

	return people.length;
}
