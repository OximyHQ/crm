import { GTM_PIPELINE } from "./gtm-config";
import { normalizeEntityName } from "./gtm-report";
import { type LinkedInQuery, linkedinQuery } from "./linkedin-clickhouse";

type EntityRow = {
	company_id: string | number;
	name: string;
	name_lower: string;
	employee_count: string | number;
};

export type EntityResolution = {
	entities: { id: string; name: string }[];
	fuzzy: boolean;
};

export async function resolveEntities(
	candidates: string[],
	query: LinkedInQuery = linkedinQuery,
): Promise<EntityResolution> {
	const probes = [
		...new Set([...candidates, ...candidates.map(normalizeEntityName)]),
	].filter(Boolean);
	const wanted = new Set(candidates.map(normalizeEntityName).filter(Boolean));
	const rows = await findEntities(probes, query);
	const exact = exactRows(rows, wanted);
	return resolution(
		exact.length > 0 ? exact : rows.slice(0, 1),
		exact.length === 0 && rows.length > 0,
	);
}

function exactRows(rows: EntityRow[], wanted: Set<string>): EntityRow[] {
	return rows.filter((row) => {
		const normalized = normalizeEntityName(row.name_lower);
		return normalized !== "" && wanted.has(normalized);
	});
}

function resolution(rows: EntityRow[], fuzzy: boolean): EntityResolution {
	return {
		entities: rows
			.slice(0, GTM_PIPELINE.resolve.entityLimit)
			.map((row) => ({ id: String(row.company_id), name: row.name })),
		fuzzy,
	};
}

async function findEntities(
	probes: string[],
	query: LinkedInQuery,
): Promise<EntityRow[]> {
	if (probes.length === 0) return [];
	const params: Record<string, unknown> = {
		re_limit: GTM_PIPELINE.resolve.candidateLimit,
	};
	const likes = probes.map((probe, index) => {
		const key = `re_name_${index}`;
		params[key] = `%${escapeLike(probe)}%`;
		return `name_lower LIKE {${key}:String}`;
	});

	return query<EntityRow>(
		`SELECT company_id, name, name_lower, employee_count
		 FROM gtm_companies FINAL
		 WHERE ${likes.join(" OR ")}
		 ORDER BY employee_count DESC, name ASC
		 LIMIT {re_limit:UInt32}`,
		params,
		{
			stage: "company resolution",
			actionableErrors: true,
			maxExecutionSeconds: GTM_PIPELINE.resolve.maxExecutionSeconds,
			retryTimeouts: false,
		},
	);
}

function escapeLike(value: string): string {
	return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}
