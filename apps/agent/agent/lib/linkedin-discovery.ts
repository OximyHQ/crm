import type { schemas } from "@crm/validation";
import { z } from "zod";
import {
	linkedinClickHouseConfigured,
	linkedinQuery,
} from "./linkedin-clickhouse";

const idValue = z.string();
const numberValue = z.union([z.number(), z.string()]).transform(Number);
const nullableText = z.string().nullable();

type LinkedinQuery = (
	query: string,
	queryParams: Record<string, unknown>,
) => Promise<unknown[]>;

export type LinkedinDiscoveryDependencies = {
	configured: () => boolean;
	query: LinkedinQuery;
};

const LIVE_LINKEDIN_DISCOVERY: LinkedinDiscoveryDependencies = {
	configured: linkedinClickHouseConfigured,
	query: (query, queryParams) =>
		linkedinQuery(query, queryParams, { stage: "discovery query" }),
};

const summaryRow = z.object({
	id: idValue,
	full_name: z.string(),
	headline: nullableText,
	profile_url: nullableText,
	location: nullableText,
	country: nullableText,
	current_title: nullableText,
	current_company: nullableText,
	current_company_id: idValue,
	company_employee_estimate: numberValue,
	connections_count: numberValue,
});

const companyRow = z.object({
	company_id: idValue,
	name: z.string(),
	employee_count: numberValue,
});

const companyUrlRow = z.object({
	company_url: z.string().min(1),
});

const employeeRow = z.object({
	profile_id: idValue,
	full_name: z.string(),
	title: z.string(),
	profile_url: z.string(),
	country: z.string().nullable(),
});

const personRow = z.object({
	id: idValue,
	full_name: z.string(),
	headline: nullableText,
	profile_url: nullableText,
	location: nullableText,
	current_title: nullableText,
	current_company: nullableText,
	current_company_id: idValue,
	education_text: nullableText,
	skills_text: nullableText,
	updated_at: z.string().nullable(),
});

type PeopleSearchInput = z.infer<
	typeof schemas.oximy.linkedinPeopleSearchInput
>;
type PersonInput = z.infer<typeof schemas.oximy.linkedinPersonInput>;
type CompanyInput = z.infer<
	typeof schemas.oximy.linkedinCompanyResolutionInput
>;
type EmployeesInput = z.infer<
	typeof schemas.oximy.linkedinCompanyEmployeesInput
>;

export async function searchLinkedinPeople(
	input: PeopleSearchInput,
	dependencies = LIVE_LINKEDIN_DISCOVERY,
) {
	return runLinkedinQuery(dependencies, async () => {
		const conditions: string[] = [];
		const params: Record<string, unknown> = {};

		addSearchTokens(
			conditions,
			params,
			"person.search_text",
			input.name,
			"name",
		);
		addCurrentTokens(
			conditions,
			params,
			"person.current_title",
			input.currentTitle,
			"title",
		);
		addCurrentTokens(
			conditions,
			params,
			"person.current_company",
			input.currentCompanyName,
			"company",
		);
		addSearchTokens(
			conditions,
			params,
			"person.past_companies_text",
			input.pastCompany,
			"past",
		);

		if (input.currentCompanyId) {
			const company = await companyForId(dependencies, input.currentCompanyId);
			if (!company) {
				return emptyPeopleResult();
			}
			if (!input.currentCompanyName) {
				addCurrentTokens(
					conditions,
					params,
					"person.current_company",
					company.name,
					"company_scope",
				);
			}
			conditions.push("person.current_company_id = {company_id:UInt64}");
			params.company_id = input.currentCompanyId;
		}
		if (input.city) {
			conditions.push("person.city = {city:String}");
			params.city = input.city;
		}
		if (input.country) {
			conditions.push("person.country = {country:String}");
			params.country = input.country;
		}
		if (input.companySizeMin !== undefined) {
			conditions.push("person.company_employee_estimate >= {size_min:UInt32}");
			params.size_min = input.companySizeMin;
		}
		if (input.companySizeMax !== undefined) {
			conditions.push("person.company_employee_estimate <= {size_max:UInt32}");
			params.size_max = input.companySizeMax;
		}
		for (const [index, skill] of (input.skills ?? []).entries()) {
			addSearchTokens(
				conditions,
				params,
				"person.skills_text",
				skill,
				`skill_${index}`,
			);
		}

		const cursor = decodePeopleCursor(input.cursor);
		if (cursor) {
			conditions.push(
				"(person.connections_count < {cursor_connections:UInt32} OR (person.connections_count = {cursor_connections:UInt32} AND person.id < {cursor_id:Int64}))",
			);
			params.cursor_connections = cursor.connections;
			params.cursor_id = cursor.id;
		}

		params.limit = input.limit + 1;
		const rows = summaryRow.array().parse(
			await dependencies.query(
				`SELECT
					toString(person.id) AS id,
					full_name,
					nullIf(headline, '') AS headline,
					nullIf(profile_url, '') AS profile_url,
					nullIf(location, '') AS location,
					nullIf(country, '') AS country,
					nullIf(current_title, '') AS current_title,
					nullIf(current_company, '') AS current_company,
					toString(person.current_company_id) AS current_company_id,
					company_employee_estimate,
					connections_count
				FROM gtm_people AS person
				WHERE ${conditions.join(" AND ")}
				ORDER BY person.connections_count DESC, person.id DESC
				LIMIT 1 BY person.id
				LIMIT {limit:UInt32}`,
				params,
			),
		);
		const page = rows.slice(0, input.limit);
		const last = page.at(-1);

		return {
			ok: true as const,
			configured: true as const,
			source: "linkedin_clickhouse" as const,
			observedAt: new Date().toISOString(),
			people: page.map(toSummary),
			nextCursor:
				rows.length > input.limit && last
					? encodeCursor({ connections: last.connections_count, id: last.id })
					: null,
			hasMore: rows.length > input.limit,
		};
	});
}

export async function getLinkedinPerson(
	input: PersonInput,
	dependencies = LIVE_LINKEDIN_DISCOVERY,
) {
	return runLinkedinQuery(dependencies, async () => {
		const rows = personRow.array().parse(
			await dependencies.query(
				`SELECT
					toString(person.id) AS id,
					full_name,
					nullIf(headline, '') AS headline,
					nullIf(profile_url, '') AS profile_url,
					nullIf(location, '') AS location,
					nullIf(current_title, '') AS current_title,
					nullIf(current_company, '') AS current_company,
					toString(current_company_id) AS current_company_id,
					nullIf(education_text, '') AS education_text,
					nullIf(skills_text, '') AS skills_text,
					toString(updated_at) AS updated_at
				FROM gtm_people AS person
				WHERE person.country = {country:String}
					AND person.id = {person_id:Int64}
				LIMIT 1`,
				{ person_id: input.personId, country: input.country },
			),
		);
		const row = rows[0];

		return {
			ok: true as const,
			configured: true as const,
			source: "linkedin_clickhouse" as const,
			observedAt: new Date().toISOString(),
			person: row ? toPerson(row) : null,
		};
	});
}

export async function resolveLinkedinCompany(
	input: CompanyInput,
	dependencies = LIVE_LINKEDIN_DISCOVERY,
) {
	return runLinkedinQuery(dependencies, async () => {
		const rows = companyRow.array().parse(
			await dependencies.query(
				`SELECT toString(company_id) AS company_id, name, employee_count
				FROM (
					SELECT company_id, name, employee_count
					FROM gtm_companies FINAL
					WHERE name_lower LIKE {company_name:String}
					ORDER BY employee_count DESC, company_id ASC
					LIMIT {limit:UInt32}
				)`,
				{
					company_name: `%${input.companyName.toLowerCase()}%`,
					limit: input.limit,
				},
			),
		);

		return {
			ok: true as const,
			configured: true as const,
			source: "linkedin_clickhouse" as const,
			observedAt: new Date().toISOString(),
			query: input.companyName,
			candidates: rows.map((row, index) => ({
				id: row.company_id,
				name: row.name,
				employeeCount: row.employee_count,
				rank: index + 1,
			})),
		};
	});
}

export async function listLinkedinCompanyEmployees(
	input: EmployeesInput,
	dependencies = LIVE_LINKEDIN_DISCOVERY,
) {
	return runLinkedinQuery(dependencies, async () => {
		const company = await companyForId(dependencies, input.companyId);
		if (!company) return emptyEmployeesResult(input.companyId);
		const companyUrl = await companyUrlForId(dependencies, input.companyId);
		if (!companyUrl) return emptyEmployeesResult(input.companyId);

		const conditions = [
			"employee.company_url = {company_url:String}",
			"employee.company_id = {company_id:UInt64}",
			"employee.is_current = 1",
		];
		const params: Record<string, unknown> = {
			company_url: companyUrl,
			company_id: input.companyId,
			limit: input.limit + 1,
		};
		if (input.currentTitle) {
			addCurrentTokens(
				conditions,
				params,
				"employee.title",
				input.currentTitle,
				"employee_title",
			);
		}
		const cursor = decodeEmployeeCursor(input.cursor);
		if (cursor) {
			conditions.push("employee.profile_id > {cursor_id:UInt64}");
			params.cursor_id = cursor;
		}

		const rows = employeeRow.array().parse(
			await dependencies.query(
				`SELECT
					toString(employee.profile_id) AS profile_id,
					employee.full_name,
					employee.title,
					employee.profile_url,
					employee.country
				FROM profile_company_lookup AS employee
				WHERE ${conditions.join(" AND ")}
				ORDER BY employee.profile_id ASC, employee.experience_id ASC
				LIMIT 1 BY employee.profile_id
				LIMIT {limit:UInt32}`,
				params,
			),
		);
		const page = rows.slice(0, input.limit);
		const last = page.at(-1);

		return {
			ok: true as const,
			configured: true as const,
			source: "linkedin_clickhouse" as const,
			observedAt: new Date().toISOString(),
			companyId: input.companyId,
			employees: page.map((employee) => ({
				id: employee.profile_id,
				idKind: "company_employee" as const,
				fullName: employee.full_name,
				headline: null,
				linkedInUrl: employee.profile_url || null,
				location: employee.country,
				country: employee.country,
				currentTitle: employee.title || null,
				currentCompany: company.name,
				currentCompanyId: input.companyId,
				companyEmployeeEstimate: company.employee_count || null,
				connectionsCount: null,
			})),
			nextCursor:
				rows.length > input.limit && last
					? encodeCursor({ id: last.profile_id })
					: null,
			hasMore: rows.length > input.limit,
		};
	});
}

async function companyForId(
	dependencies: LinkedinDiscoveryDependencies,
	companyId: string,
) {
	const rows = companyRow.array().parse(
		await dependencies.query(
			`SELECT toString(company_id) AS company_id, name, employee_count
			FROM (
				SELECT company_id, name, employee_count
				FROM gtm_companies FINAL
				WHERE company_id = {company_id:UInt64}
				LIMIT 1
			)`,
			{ company_id: companyId },
		),
	);
	return rows[0] ?? null;
}

async function companyUrlForId(
	dependencies: LinkedinDiscoveryDependencies,
	companyId: string,
): Promise<string | null> {
	const rows = companyUrlRow.array().parse(
		await dependencies.query(
			`SELECT company_url
			FROM profile_company_lookup
			WHERE company_id = {company_id:UInt64}
				AND is_current = 1
				AND company_url != ''
			LIMIT 1`,
			{ company_id: companyId },
		),
	);
	return rows[0]?.company_url ?? null;
}

function emptyPeopleResult() {
	return {
		ok: true as const,
		configured: true as const,
		source: "linkedin_clickhouse" as const,
		observedAt: new Date().toISOString(),
		people: [],
		nextCursor: null,
		hasMore: false,
	};
}

function emptyEmployeesResult(companyId: string) {
	return {
		ok: true as const,
		configured: true as const,
		source: "linkedin_clickhouse" as const,
		observedAt: new Date().toISOString(),
		companyId,
		employees: [],
		nextCursor: null,
		hasMore: false,
	};
}

async function runLinkedinQuery<T>(
	dependencies: LinkedinDiscoveryDependencies,
	operation: () => Promise<T>,
) {
	if (!dependencies.configured()) {
		return {
			ok: false as const,
			configured: false,
			reason: "LinkedIn ClickHouse is not configured for this CRM agent.",
		};
	}

	try {
		return await operation();
	} catch (error) {
		return {
			ok: false as const,
			configured: true,
			reason: error instanceof Error ? error.message : String(error),
		};
	}
}

function toSummary(row: z.infer<typeof summaryRow>) {
	return {
		id: row.id,
		idKind: "profile" as const,
		fullName: row.full_name,
		headline: row.headline,
		linkedInUrl: row.profile_url,
		location: row.location,
		country: row.country,
		currentTitle: row.current_title,
		currentCompany: row.current_company,
		currentCompanyId:
			row.current_company_id === "0" ? null : row.current_company_id,
		companyEmployeeEstimate: row.company_employee_estimate || null,
		connectionsCount: row.connections_count || null,
	};
}

function toPerson(row: z.infer<typeof personRow>) {
	const currentRoles =
		row.current_title || row.current_company
			? [
					{
						title: row.current_title,
						companyName: row.current_company,
						companyId:
							row.current_company_id === "0" ? null : row.current_company_id,
						startedAt: null,
						endedAt: null,
					},
				]
			: [];

	return {
		id: row.id,
		fullName: row.full_name,
		headline: row.headline,
		linkedInUrl: row.profile_url,
		location: row.location,
		currentRoles,
		recentWorkHistory: currentRoles,
		education: row.education_text ? [row.education_text] : [],
		skills: row.skills_text ? [row.skills_text] : [],
		sourceTimestamp: row.updated_at,
	};
}

function addSearchTokens(
	conditions: string[],
	params: Record<string, unknown>,
	column: string,
	value: string | undefined,
	prefix: string,
): void {
	if (!value) return;
	for (const [index, token] of tokenize(value).entries()) {
		const key = `${prefix}_${index}`;
		conditions.push(`hasToken(${column}, {${key}:String})`);
		params[key] = token.toLowerCase();
	}
}

function addCurrentTokens(
	conditions: string[],
	params: Record<string, unknown>,
	column: string,
	value: string | undefined,
	prefix: string,
): void {
	if (!value) return;
	for (const [index, token] of tokenize(value).entries()) {
		const variants = tokenVariants(token);
		const expressions = variants.map((variant, variantIndex) => {
			const key = `${prefix}_${index}_${variantIndex}`;
			params[key] = variant;
			return `hasToken(${column}, {${key}:String})`;
		});
		conditions.push(`(${expressions.join(" OR ")})`);
	}
}

function tokenize(value: string): string[] {
	return value.split(/[^A-Za-z0-9]+/).filter(Boolean);
}

function tokenVariants(value: string): string[] {
	const lower = value.toLowerCase();
	const title = lower.charAt(0).toUpperCase() + lower.slice(1);
	const primary = value.length <= 4 ? value.toUpperCase() : title;
	return [...new Set([primary, lower, value])];
}

function encodeCursor(value: Record<string, string | number>): string {
	return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decodePeopleCursor(value: string | undefined) {
	if (!value) return null;
	const schema = z.object({
		connections: z.number().int().min(0),
		id: idValue,
	});
	return schema.parse(
		JSON.parse(Buffer.from(value, "base64url").toString("utf8")),
	);
}

function decodeEmployeeCursor(value: string | undefined): string | null {
	if (!value) return null;
	const parsed = z
		.object({ id: idValue })
		.parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
	return parsed.id;
}
