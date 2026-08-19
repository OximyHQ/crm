import { afterEach, describe, expect, it } from "bun:test";
import { schemas } from "@crm/validation";
import {
	getLinkedinPerson,
	type LinkedinDiscoveryDependencies,
	listLinkedinCompanyEmployees,
	resolveLinkedinCompany,
	searchLinkedinPeople,
} from "./linkedin-discovery";

const originalHost = process.env.LINKEDIN_CLICKHOUSE_HOST;

const summary = {
	id: "9223372036854775807",
	full_name: "Sample Seller",
	headline: "Technology leader",
	profile_url: "https://www.linkedin.com/in/sample-seller",
	location: "Sample City",
	country: "United States",
	current_title: "CTO",
	current_company: "Sample Company",
	current_company_id: "18446744073709551615",
	company_employee_estimate: 120,
	connections_count: 500,
};

afterEach(() => {
	if (originalHost === undefined) {
		delete process.env.LINKEDIN_CLICKHOUSE_HOST;
	} else {
		process.env.LINKEDIN_CLICKHOUSE_HOST = originalHost;
	}
});

describe("LinkedIn discovery", () => {
	it("requires a bounded people search", () => {
		expect(schemas.oximy.linkedinPeopleSearchInput.safeParse({}).success).toBe(
			false,
		);
		expect(
			schemas.oximy.linkedinPeopleSearchInput.safeParse({ currentTitle: "CTO" })
				.success,
		).toBe(false);
		expect(
			schemas.oximy.linkedinPeopleSearchInput.safeParse({
				currentTitle: "CTO",
				country: "United States",
			}).success,
		).toBe(true);
	});

	it("returns unavailable when ClickHouse is not configured", async () => {
		delete process.env.LINKEDIN_CLICKHOUSE_HOST;
		const input = schemas.oximy.linkedinPeopleSearchInput.parse({
			currentTitle: "CTO",
			country: "United States",
		});

		expect(await searchLinkedinPeople(input)).toEqual({
			ok: false,
			configured: false,
			reason: "LinkedIn ClickHouse is not configured for this CRM agent.",
		});
	});

	it("parses people pages with string identifiers and stable cursors", async () => {
		const calls: Array<{ sql: string; params: Record<string, unknown> }> = [];
		const dependencies = stub(async (sql, params) => {
			calls.push({ sql, params });
			return calls.length === 1
				? [summary, { ...summary, id: "9223372036854775806" }]
				: [{ ...summary, id: "9223372036854775805" }];
		});
		const first = await searchLinkedinPeople(
			{ currentTitle: "CTO", country: "United States", limit: 1 },
			dependencies,
		);
		expect(first.ok).toBe(true);
		if (!first.ok) return;
		expect(first.people[0]?.id).toBe("9223372036854775807");
		expect(first.people[0]?.idKind).toBe("profile");
		expect(first.hasMore).toBe(true);
		expect(first.nextCursor).not.toBeNull();
		expect(calls[0]?.sql).toContain("toString(person.id) AS id");
		expect(calls[0]?.sql).toContain(
			"toString(person.current_company_id) AS current_company_id",
		);

		await searchLinkedinPeople(
			{
				currentTitle: "CTO",
				country: "United States",
				limit: 1,
				cursor: first.nextCursor ?? undefined,
			},
			dependencies,
		);
		expect(calls[1]?.params.cursor_id).toBe("9223372036854775807");
	});

	it("gets one searched profile through its bounded source key", async () => {
		const dependencies = stub(async (sql) => {
			expect(sql).toContain("FROM gtm_people AS person");
			expect(sql).toContain("person.country = {country:String}");
			return [
				{
					id: "9223372036854775807",
					full_name: "Sample Seller",
					headline: "Technology leader",
					profile_url: "https://www.linkedin.com/in/sample-seller",
					location: "Sample City",
					current_title: "CTO",
					current_company: "Sample Company",
					current_company_id: "18446744073709551615",
					education_text: "Sample University Computer Science",
					skills_text: "Architecture",
					updated_at: "2026-08-19 00:00:00",
				},
			];
		});
		const result = await getLinkedinPerson(
			{ personId: "9223372036854775807", country: "United States" },
			dependencies,
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.person?.currentRoles[0]?.companyId).toBe(
			"18446744073709551615",
		);
		expect(result.person?.recentWorkHistory).toHaveLength(1);
		expect(result.person?.education).toEqual([
			"Sample University Computer Science",
		]);
		expect(result.person?.skills).toEqual(["Architecture"]);
	});

	it("resolves companies with string identifiers", async () => {
		const dependencies = stub(async (sql) => {
			expect(sql).toContain("toString(company_id) AS company_id");
			expect(sql).toContain("FROM (");
			return [
				{
					company_id: "18446744073709551615",
					name: "Sample Company",
					employee_count: 120,
				},
			];
		});
		const result = await resolveLinkedinCompany(
			{ companyName: "Sample Company", limit: 10 },
			dependencies,
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.candidates[0]?.id).toBe("18446744073709551615");
	});

	it("lists employees through the company URL sorting key", async () => {
		const calls: Array<{ sql: string; params: Record<string, unknown> }> = [];
		const dependencies = stub(async (sql, params) => {
			calls.push({ sql, params });
			if (sql.includes("FROM gtm_companies")) {
				return [
					{
						company_id: "18446744073709551615",
						name: "Sample Company",
						employee_count: 120,
					},
				];
			}
			if (sql.includes("SELECT company_url")) {
				return [{ company_url: "https://www.linkedin.com/company/sample" }];
			}
			return [
				{
					profile_id: "9223372036854775807",
					full_name: "Sample Seller",
					title: "CTO",
					profile_url: "https://www.linkedin.com/in/sample-seller",
					country: "United States",
				},
				{
					profile_id: "9223372036854775806",
					full_name: "Second Seller",
					title: "CTO",
					profile_url: "https://www.linkedin.com/in/second-seller",
					country: "United States",
				},
			];
		});
		const result = await listLinkedinCompanyEmployees(
			{
				companyId: "18446744073709551615",
				currentTitle: "CTO",
				limit: 1,
			},
			dependencies,
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.employees[0]?.id).toBe("9223372036854775807");
		expect(result.employees[0]?.idKind).toBe("company_employee");
		expect(result.nextCursor).not.toBeNull();
		expect(calls[1]?.sql).toContain("SELECT company_url");
		expect(calls[2]?.sql).toContain("FROM profile_company_lookup AS employee");
		expect(calls[2]?.sql).toContain(
			"employee.company_url = {company_url:String}",
		);
	});
});

function stub(
	query: LinkedinDiscoveryDependencies["query"],
): LinkedinDiscoveryDependencies {
	return { configured: () => true, query };
}
