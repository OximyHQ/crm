import type { schemas } from "@crm/validation";
import { z } from "zod";
import {
	linkedinClickHouseConfigured,
	linkedinQuery,
} from "./linkedin-clickhouse";
import { LINKEDIN_DISCOVERY } from "./linkedin-config";

const idValue = z.string();
const numberValue = z.union([z.number(), z.string()]).transform(Number);
const nullableText = z.string().nullable();

const summaryRow = z.object({
	id: idValue,
	full_name: z.string(),
	headline: nullableText,
	profile_url: nullableText,
	location: nullableText,
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

const employeeRow = z.object({
	profile_id: idValue,
	title: z.string(),
	company_id: idValue,
	company_name: z.string(),
});

const experienceRow = z.object({
	title: z.string().nullable().optional(),
	company_name: z.string().nullable().optional(),
	company_id: idValue.nullable().optional(),
	date_from: z.string().nullable().optional(),
	date_to: z.string().nullable().optional(),
	is_current: numberValue,
	deleted: numberValue,
});

const educationRow = z.object({
	institution: z.string().nullable().optional(),
	program: z.string().nullable().optional(),
	deleted: numberValue,
});

const personRow = z.object({
	id: idValue,
	full_name: z.string(),
	headline: nullableText,
	profile_url: nullableText,
	location: nullableText,
	connections_count: numberValue,
	experience: z.array(experienceRow),
	education: z.array(educationRow),
	inferred_skills: z.array(z.string()),
	checked_at: z.string().nullable(),
});

const profileSummaryRow = z.object({
	id: idValue,
	full_name: z.string(),
	headline: nullableText,
	profile_url: nullableText,
	location: nullableText,
	connections_count: numberValue,
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

export async function searchLinkedinPeople(input: PeopleSearchInput) {
	return runLinkedinQuery(async () => {
		const conditions: string[] = [];
		const params: Record<string, unknown> = {};

		addSearchTokens(conditions, params, "search_text", input.name, "name");
		addCurrentTokens(
			conditions,
			params,
			"current_title",
			input.currentTitle,
			"title",
		);
		addCurrentTokens(
			conditions,
			params,
			"current_company",
			input.currentCompanyName,
			"company",
		);
		addSearchTokens(
			conditions,
			params,
			"past_companies_text",
			input.pastCompany,
			"past",
		);

		if (input.currentCompanyId) {
			conditions.push("current_company_id = {company_id:UInt64}");
			params.company_id = input.currentCompanyId;
		}
		if (input.city) {
			conditions.push("city = {city:String}");
			params.city = input.city;
		}
		if (input.country) {
			conditions.push("country = {country:String}");
			params.country = input.country;
		}
		if (input.companySizeMin !== undefined) {
			conditions.push("company_employee_estimate >= {size_min:UInt32}");
			params.size_min = input.companySizeMin;
		}
		if (input.companySizeMax !== undefined) {
			conditions.push("company_employee_estimate <= {size_max:UInt32}");
			params.size_max = input.companySizeMax;
		}
		for (const [index, skill] of (input.skills ?? []).entries()) {
			addSearchTokens(
				conditions,
				params,
				"skills_text",
				skill,
				`skill_${index}`,
			);
		}

		const cursor = decodePeopleCursor(input.cursor);
		if (cursor) {
			conditions.push(
				"(connections_count < {cursor_connections:UInt32} OR (connections_count = {cursor_connections:UInt32} AND id < {cursor_id:Int64}))",
			);
			params.cursor_connections = cursor.connections;
			params.cursor_id = cursor.id;
		}

		params.limit = input.limit + 1;
		const rows = summaryRow.array().parse(
			await linkedinQuery(
				`SELECT
					id,
					full_name,
					nullIf(headline, '') AS headline,
					nullIf(profile_url, '') AS profile_url,
					nullIf(location, '') AS location,
					nullIf(current_title, '') AS current_title,
					nullIf(current_company, '') AS current_company,
					current_company_id,
					company_employee_estimate,
					connections_count
				FROM gtm_people
				WHERE ${conditions.join(" AND ")}
				ORDER BY connections_count DESC, id DESC
				LIMIT 1 BY id
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

export async function getLinkedinPerson(input: PersonInput) {
	return runLinkedinQuery(async () => {
		const rows = personRow.array().parse(
			await linkedinQuery(
				`SELECT
					id,
					full_name,
					headline,
					profile_url,
					location,
					COALESCE(connections_count, 0) AS connections_count,
					experience,
					education,
					inferred_skills,
					toString(checked_at) AS checked_at
				FROM profiles
				WHERE id = {person_id:Int64} AND deleted = 0 AND is_parent = 1
				LIMIT 1`,
				{ person_id: input.personId },
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

export async function resolveLinkedinCompany(input: CompanyInput) {
	return runLinkedinQuery(async () => {
		const rows = companyRow.array().parse(
			await linkedinQuery(
				`SELECT company_id, name, employee_count
				FROM gtm_companies FINAL
				WHERE name_lower LIKE {company_name:String}
				ORDER BY employee_count DESC, company_id ASC
				LIMIT {limit:UInt32}`,
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

export async function listLinkedinCompanyEmployees(input: EmployeesInput) {
	return runLinkedinQuery(async () => {
		const conditions = ["company_id = {company_id:UInt64}", "is_current = 1"];
		const params: Record<string, unknown> = {
			company_id: input.companyId,
			limit: input.limit + 1,
		};
		if (input.currentTitle) {
			addCurrentTokens(
				conditions,
				params,
				"title",
				input.currentTitle,
				"employee_title",
			);
		}
		if (input.cursor) {
			const cursor = decodeEmployeeCursor(input.cursor);
			conditions.push("profile_id > {cursor_id:Int64}");
			params.cursor_id = cursor;
		}

		const candidates = employeeRow.array().parse(
			await linkedinQuery(
				`SELECT profile_id, title, company_id, company_name
				FROM profile_company_lookup
				WHERE ${conditions.join(" AND ")}
				ORDER BY profile_id ASC
				LIMIT {limit:UInt32}`,
				params,
			),
		);
		const page = candidates.slice(0, input.limit);
		const profiles = profileSummaryRow.array().parse(
			page.length === 0
				? []
				: await linkedinQuery(
						`SELECT
							id,
							full_name,
							headline,
							profile_url,
							location,
							COALESCE(connections_count, 0) AS connections_count
						FROM profiles
						WHERE id IN ({profile_ids:Array(Int64)})
							AND deleted = 0
							AND is_parent = 1
						LIMIT {profile_limit:UInt32}`,
						{
							profile_ids: page.map((row) => row.profile_id),
							profile_limit: page.length,
						},
					),
		);
		const profilesById = new Map(profiles.map((row) => [row.id, row]));
		const employees = page.flatMap((candidate) => {
			const profile = profilesById.get(candidate.profile_id);
			if (!profile) return [];
			return [
				{
					id: profile.id,
					fullName: profile.full_name,
					headline: profile.headline,
					linkedInUrl: profile.profile_url,
					location: profile.location,
					currentTitle: candidate.title || null,
					currentCompany: candidate.company_name || null,
					currentCompanyId: candidate.company_id,
					companyEmployeeEstimate: null,
					connectionsCount: profile.connections_count,
				},
			];
		});
		const last = page.at(-1);

		return {
			ok: true as const,
			configured: true as const,
			source: "linkedin_clickhouse" as const,
			observedAt: new Date().toISOString(),
			companyId: input.companyId,
			employees,
			nextCursor:
				candidates.length > input.limit && last
					? encodeCursor({ id: last.profile_id })
					: null,
			hasMore: candidates.length > input.limit,
		};
	});
}

async function runLinkedinQuery<T>(operation: () => Promise<T>) {
	if (!linkedinClickHouseConfigured()) {
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
		fullName: row.full_name,
		headline: row.headline,
		linkedInUrl: row.profile_url,
		location: row.location,
		currentTitle: row.current_title,
		currentCompany: row.current_company,
		currentCompanyId:
			row.current_company_id === "0" ? null : row.current_company_id,
		companyEmployeeEstimate: row.company_employee_estimate || null,
		connectionsCount: row.connections_count || null,
	};
}

function toPerson(row: z.infer<typeof personRow>) {
	const roles = row.experience
		.filter((entry) => entry.deleted === 0)
		.map((entry) => ({
			title: entry.title ?? null,
			companyName: entry.company_name ?? null,
			companyId: entry.company_id ?? null,
			startedAt: entry.date_from ?? null,
			endedAt: entry.date_to ?? null,
		}));

	return {
		id: row.id,
		fullName: row.full_name,
		headline: row.headline,
		linkedInUrl: row.profile_url,
		location: row.location,
		currentRoles: row.experience
			.filter((entry) => entry.deleted === 0 && entry.is_current === 1)
			.slice(0, LINKEDIN_DISCOVERY.results.currentRoles)
			.map((entry) => ({
				title: entry.title ?? null,
				companyName: entry.company_name ?? null,
				companyId: entry.company_id ?? null,
				startedAt: entry.date_from ?? null,
				endedAt: entry.date_to ?? null,
			})),
		recentWorkHistory: roles.slice(0, LINKEDIN_DISCOVERY.results.workHistory),
		education: row.education
			.filter((entry) => entry.deleted === 0)
			.slice(0, LINKEDIN_DISCOVERY.results.education)
			.map((entry) =>
				[entry.institution, entry.program].filter(Boolean).join(" — "),
			)
			.filter(Boolean),
		skills: row.inferred_skills.slice(0, LINKEDIN_DISCOVERY.results.skills),
		sourceTimestamp: row.checked_at,
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

function decodeEmployeeCursor(value: string): string {
	const parsed = z
		.object({ id: idValue })
		.parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
	return parsed.id;
}
