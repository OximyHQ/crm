import { db, type Prisma } from "@crm/db";
import { GTM_PIPELINE, GTM_UNMATCHED_RANK } from "./gtm-config";
import { buildCoarseRankSql, matchTitle } from "./gtm-matcher";
import { analyzeOrg, gtmOrganizeConfigured } from "./gtm-organize";
import {
	dedupeByName,
	departedPerProfile,
	type GtmPeopleResult,
	nameCandidates,
	normalizeEntityName,
	type PersonProfile,
	type ProfileExperience,
	parseCrawlDate,
} from "./gtm-report";
import { gtmVerifyConfigured, verifyStillAtCompany } from "./gtm-verify";
import {
	linkedinClickHouseConfigured,
	linkedinQuery,
} from "./linkedin-clickhouse";

export { type GtmPeopleResult, gtmPeopleOutcome } from "./gtm-report";

type EntityRow = {
	company_id: string | number;
	name: string;
	name_lower: string;
	employee_count: string | number;
};

type RosterRow = {
	profile_id: string | number;
	title: string;
	company_name: string;
	tier: string | number;
};

type ExperienceRow = {
	title: string;
	company_name: string;
	company_id: string | number | null;
	date_from: string;
	date_to: string;
	is_current: number | string;
};

type ProfileRow = {
	id: string | number;
	full_name: string;
	headline: string;
	profile_url: string;
	city: string;
	state: string;
	country: string;
	connections_count: string | number;
	follower_count: string | number;
	updated_at: string | null;
	experience: ExperienceRow[];
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
			reason: `Matched ${capped.length} titles, but none of the profiles could be read. Nothing was changed.`,
		};
	}

	const entityNames = entities.map((entity) => entity.name);
	const entityIds = entities.map((entity) => entity.id);
	const hydrated = capped.flatMap((row) => {
		const profile = profiles.get(row.personId);
		if (!profile?.full_name) return [];
		return [
			{
				...row,
				profile,
				experiences: toExperiences(profile.experience),
				fullName: profile.full_name,
				asOf: parseCrawlDate(profile.updated_at),
			},
		];
	});
	const unique = dedupeByName(hydrated).kept;
	let departed = 0;
	let present = unique.filter((row) => {
		if (departedPerProfile(row.experiences, entityNames, entityIds)) {
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
					tier: entry.seniorityRank <= 4 ? 1 : 2,
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

type EntityResolution = {
	entities: { id: string; name: string }[];
	fuzzy: boolean;
};

async function resolveEntities(
	candidates: string[],
): Promise<EntityResolution> {
	const params: Record<string, unknown> = {
		re_limit: GTM_PIPELINE.resolve.candidateLimit,
	};
	const probes = [
		...new Set([...candidates, ...candidates.map(normalizeEntityName)]),
	].filter(Boolean);
	const likes = probes.map((probe, index) => {
		const key = `re_name_${index}`;
		params[key] = `%${escapeLike(probe)}%`;
		return `name_lower LIKE {${key}:String}`;
	});

	const rows = await linkedinQuery<EntityRow>(
		`SELECT company_id, name, name_lower, employee_count
		 FROM gtm_companies FINAL
		 WHERE ${likes.join(" OR ")}
		 ORDER BY employee_count DESC
		 LIMIT {re_limit:UInt32}`,
		params,
	);

	const wanted = new Set(candidates.map(normalizeEntityName).filter(Boolean));
	const exact = rows.filter((row) => {
		const normalized = normalizeEntityName(row.name_lower);
		return normalized !== "" && wanted.has(normalized);
	});
	const picked = exact.length > 0 ? exact : rows.slice(0, 1);
	return {
		entities: picked
			.slice(0, GTM_PIPELINE.resolve.entityLimit)
			.map((row) => ({ id: String(row.company_id), name: row.name })),
		fuzzy: exact.length === 0 && rows.length > 0,
	};
}

function escapeLike(value: string): string {
	return value.replace(/[\\%_]/g, (match) => `\\${match}`);
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
		{ maxExecutionSeconds: GTM_PIPELINE.roster.maxExecutionSeconds },
	);
}

async function hydrateProfiles(
	personIds: string[],
): Promise<Map<string, ProfileRow>> {
	if (personIds.length === 0) return new Map();

	const rows = await linkedinQuery<ProfileRow>(
		`SELECT
			id, full_name,
			COALESCE(headline, '') AS headline,
			profile_url,
			COALESCE(city, '') AS city,
			COALESCE(state, '') AS state,
			COALESCE(country, '') AS country,
			COALESCE(connections_count, 0) AS connections_count,
			COALESCE(follower_count, 0) AS follower_count,
			toString(updated_at) AS updated_at,
			arrayFilter(x -> x.deleted = 0, experience) AS experience
		 FROM profiles
		 WHERE id IN ({hy_ids:Array(Int64)}) AND is_parent = 1 AND deleted = 0
		 LIMIT {hy_limit:UInt32}`,
		{ hy_ids: personIds.map(Number), hy_limit: personIds.length },
	);

	return new Map(rows.map((row) => [String(row.id), row]));
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
