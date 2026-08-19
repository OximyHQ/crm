import { db, type Prisma } from "@crm/db";
import { gtmConfigured, gtmQuery } from "./gtm-clickhouse";
import { GTM_PIPELINE } from "./gtm-config";
import { buildCoarseTierSql, matchTitle } from "./gtm-matcher";
import {
	departedPerProfile,
	type GtmPeopleResult,
	nameCandidates,
	type ProfileExperience,
	type ProspectProfile,
	parseCrawlDate,
} from "./gtm-report";
import { gtmVerifyConfigured, verifyStillAtCompany } from "./gtm-verify";

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

export async function runGtmPeople({
	companyId,
}: {
	companyId: string;
}): Promise<GtmPeopleResult> {
	const company = await db.company.findUnique({
		where: { id: companyId },
		select: { id: true, name: true, domain: true },
	});

	if (!company) return { ...NONE, reason: "No such company." };

	if (!gtmConfigured()) {
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

	const entities = await resolveEntities(candidates);
	if (entities.length === 0) {
		return {
			...NONE,
			reason: `No LinkedIn company matched "${company.name}".`,
		};
	}

	const roster = await fetchRoster(entities.map((entity) => entity.id));
	const coarseTruncated = roster.length >= GTM_PIPELINE.roster.coarseLimit;

	const matched = new Map<
		string,
		{
			personId: string;
			title: string;
			companyName: string;
			tier: number;
			orgFunction: string;
			seniorityRank: number;
		}
	>();
	for (const row of roster) {
		const match = matchTitle(row.title);
		if (!match) continue;
		const personId = String(row.profile_id);
		const existing = matched.get(personId);
		if (existing && existing.tier <= match.tier) continue;
		matched.set(personId, {
			personId,
			title: row.title,
			companyName: row.company_name,
			...match,
		});
	}

	const ranked = [...matched.values()].sort(
		(a, b) =>
			a.tier - b.tier ||
			a.seniorityRank - b.seniorityRank ||
			a.personId.localeCompare(b.personId),
	);
	const kept = ranked.slice(0, GTM_PIPELINE.keep.limit);
	const truncated = coarseTruncated || ranked.length > kept.length;

	const profiles = await hydrateProfiles(kept.map((row) => row.personId));

	if (kept.length > 0 && profiles.size === 0) {
		return {
			...NONE,
			entities: entities.length,
			reason: `Matched ${kept.length} titles, but none of the profiles could be read. Nothing was changed.`,
		};
	}

	const entityNames = entities.map((entity) => entity.name);
	const entityIds = entities.map((entity) => entity.id);
	let departed = 0;
	const people = kept.flatMap((row) => {
		const profile = profiles.get(row.personId);
		if (!profile?.full_name) return [];
		const experiences = toExperiences(profile.experience);
		if (departedPerProfile(experiences, entityNames, entityIds)) {
			departed += 1;
			return [];
		}
		const asOf = parseCrawlDate(profile.updated_at);
		const stored: ProspectProfile = {
			headline: profile.headline || null,
			asOf: asOf?.toISOString() ?? null,
			experiences: experiences.slice(0, GTM_PIPELINE.profile.experienceLimit),
		};
		return [
			{
				personId: row.personId,
				fullName: profile.full_name,
				title: row.title,
				headline: profile.headline || null,
				city: profile.city || null,
				state: profile.state || null,
				country: profile.country || null,
				linkedinUrl: profile.profile_url || null,
				connectionsCount: Number(profile.connections_count) || 0,
				followerCount: Number(profile.follower_count) || 0,
				tier: row.tier,
				orgFunction: row.orgFunction,
				seniorityRank: row.seniorityRank,
				profile: stored as unknown as Prisma.InputJsonValue,
				profileAsOf: asOf,
			},
		];
	});

	let verifiedOut = 0;
	let toSave = people;
	if (gtmVerifyConfigured() && people.length > 0) {
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

	const saved = await savePeople(companyId, toSave);

	return {
		saved,
		tier1: toSave.filter((person) => person.tier === 1).length,
		tier2: toSave.filter((person) => person.tier === 2).length,
		entities: entities.length,
		truncated,
		departed,
		verifiedOut,
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

async function resolveEntities(
	candidates: string[],
): Promise<{ id: string; name: string }[]> {
	const params: Record<string, unknown> = {
		re_limit: GTM_PIPELINE.resolve.candidateLimit,
	};
	const likes = candidates.map((candidate, index) => {
		const key = `re_name_${index}`;
		params[key] = `%${candidate}%`;
		return `name_lower LIKE {${key}:String}`;
	});

	const rows = await gtmQuery<EntityRow>(
		`SELECT company_id, name, name_lower, employee_count
		 FROM gtm_companies FINAL
		 WHERE ${likes.join(" OR ")}
		 ORDER BY employee_count DESC
		 LIMIT {re_limit:UInt32}`,
		params,
	);

	const wanted = new Set(candidates);
	const exact = rows.filter((row) => wanted.has(row.name_lower.trim()));
	const picked = exact.length > 0 ? exact : rows.slice(0, 1);

	return picked
		.slice(0, GTM_PIPELINE.resolve.entityLimit)
		.map((row) => ({ id: String(row.company_id), name: row.name }));
}

async function fetchRoster(entityIds: string[]): Promise<RosterRow[]> {
	const tierExpr = buildCoarseTierSql("title");
	return gtmQuery<RosterRow>(
		`SELECT profile_id, title, company_name, tier
		 FROM (
			SELECT profile_id, title, company_name, ${tierExpr} AS tier
			FROM profile_company_lookup
			WHERE company_id IN ({ro_ids:Array(UInt64)}) AND is_current = 1
		 )
		 WHERE tier <= 2
		 ORDER BY tier ASC, profile_id ASC
		 LIMIT {ro_limit:UInt32}`,
		{
			ro_ids: entityIds.map(Number),
			ro_limit: GTM_PIPELINE.roster.coarseLimit,
		},
	);
}

async function hydrateProfiles(
	personIds: string[],
): Promise<Map<string, ProfileRow>> {
	if (personIds.length === 0) return new Map();

	const rows = await gtmQuery<ProfileRow>(
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
	profile: Prisma.InputJsonValue;
	profileAsOf: Date | null;
};

const UPDATE_CHUNK = 25;

async function savePeople(
	companyId: string,
	people: PersonUpsert[],
): Promise<number> {
	const existing = await db.companyProspect.findMany({
		where: { companyId },
		select: { personId: true },
	});
	const known = new Set(existing.map((row) => row.personId));

	const fresh = people.filter((person) => !known.has(person.personId));
	const stale = people.filter((person) => known.has(person.personId));

	if (fresh.length > 0) {
		await db.companyProspect.createMany({
			data: fresh.map((person) => ({ companyId, ...person })),
			skipDuplicates: true,
		});
	}

	for (let start = 0; start < stale.length; start += UPDATE_CHUNK) {
		const chunk = stale.slice(start, start + UPDATE_CHUNK);
		await Promise.all(
			chunk.map(({ personId, ...data }) =>
				db.companyProspect.update({
					where: { companyId_personId: { companyId, personId } },
					data,
				}),
			),
		);
	}

	await db.companyProspect.deleteMany({
		where: {
			companyId,
			status: "SUGGESTED",
			personId: { notIn: people.map((person) => person.personId) },
		},
	});

	return people.length;
}
