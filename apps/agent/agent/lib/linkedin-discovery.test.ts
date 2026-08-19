import { afterEach, describe, expect, it } from "bun:test";
import { schemas } from "@crm/validation";
import { searchLinkedinPeople } from "./linkedin-discovery";

const originalHost = process.env.LINKEDIN_CLICKHOUSE_HOST;

afterEach(() => {
	if (originalHost === undefined) {
		delete process.env.LINKEDIN_CLICKHOUSE_HOST;
	} else {
		process.env.LINKEDIN_CLICKHOUSE_HOST = originalHost;
	}
});

describe("LinkedIn discovery", () => {
	it("requires at least one people filter", () => {
		const result = schemas.oximy.linkedinPeopleSearchInput.safeParse({});
		expect(result.success).toBe(false);
	});

	it("returns unavailable when ClickHouse is not configured", async () => {
		delete process.env.LINKEDIN_CLICKHOUSE_HOST;
		const input = schemas.oximy.linkedinPeopleSearchInput.parse({
			currentTitle: "CTO",
		});

		expect(await searchLinkedinPeople(input)).toEqual({
			ok: false,
			configured: false,
			reason: "LinkedIn ClickHouse is not configured for this CRM agent.",
		});
	});

	it("keeps ClickHouse identifiers as strings", () => {
		const result = schemas.oximy.linkedinPeopleSearchResult.parse({
			ok: true,
			configured: true,
			source: "linkedin_clickhouse",
			observedAt: new Date().toISOString(),
			people: [
				{
					id: "9223372036854775807",
					fullName: "A Seller",
					headline: null,
					linkedInUrl: null,
					location: null,
					currentTitle: null,
					currentCompany: null,
					currentCompanyId: "18446744073709551615",
					companyEmployeeEstimate: null,
					connectionsCount: null,
				},
			],
			nextCursor: null,
			hasMore: false,
		});

		expect(result.ok && result.people[0]?.id).toBe("9223372036854775807");
	});
});
