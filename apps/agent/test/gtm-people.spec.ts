import { describe, expect, it } from "bun:test";
import { hydrateProfiles } from "../agent/lib/gtm-profile";
import {
	dedupeByName,
	departedPerProfile,
	gtmPeopleOutcome,
	nameCandidates,
	normalizeEntityName,
	type ProfileExperience,
	parseCrawlDate,
	parseOrgAnalysis,
	parseVerifyAnswer,
} from "../agent/lib/gtm-report";
import { resolveEntities } from "../agent/lib/gtm-resolve";
import {
	type LinkedInQuery,
	linkedinQueryWithClient,
} from "../agent/lib/linkedin-clickhouse";

type EntityRow = {
	company_id: string | number;
	name: string;
	name_lower: string;
	employee_count: string | number;
};

function entityQuery(...responses: EntityRow[][]): {
	query: LinkedInQuery;
	calls: { options: Parameters<LinkedInQuery>[2] }[];
} {
	const calls: { options: Parameters<LinkedInQuery>[2] }[] = [];
	const query: LinkedInQuery = async <Row>(
		_query,
		_params,
		options,
	): Promise<Row[]> => {
		calls.push({ options });
		return (responses.shift() ?? []) as Row[];
	};
	return { query, calls };
}

function experience(
	company: string,
	current: boolean,
	to: string | null = current ? null : "September 2025",
	companyId: string | null = null,
): ProfileExperience {
	return {
		title: "CFO",
		company,
		companyId,
		from: "December 2021",
		to,
		current,
	};
}

describe("departedPerProfile", () => {
	it("drops a person whose only role at the company has ended", () => {
		expect(
			departedPerProfile(
				[experience("Neurealm", false), experience("ZENRE", true)],
				["Neurealm"],
			),
		).toBe(true);
	});

	it("keeps a person whose role at the company is current", () => {
		expect(
			departedPerProfile([experience("Neurealm", true)], ["Neurealm"]),
		).toBe(false);
	});

	it("keeps a person whose profile never names the company", () => {
		expect(
			departedPerProfile([experience("Some Agency", true)], ["Neurealm"]),
		).toBe(false);
	});

	it("matches company names loosely", () => {
		expect(
			departedPerProfile(
				[experience("Neurealm (Formerly GSLab|GAVS)", true)],
				["Neurealm"],
			),
		).toBe(false);
		expect(
			departedPerProfile(
				[experience("Neurealm (Formerly GSLab|GAVS)", false)],
				["Neurealm"],
			),
		).toBe(true);
	});

	it("matches by entity id even when the names differ", () => {
		expect(
			departedPerProfile(
				[
					experience(
						"A Totally Different Label",
						false,
						"May 2025",
						"92538015",
					),
				],
				["Neurealm"],
				["92538015"],
			),
		).toBe(true);
	});
});

describe("normalizeEntityName", () => {
	it("strips the leading article, punctuation and corporate suffixes", () => {
		expect(normalizeEntityName("The Wall Street Journal")).toBe(
			"wall street journal",
		);
		expect(normalizeEntityName("wall street journal")).toBe(
			"wall street journal",
		);
		expect(normalizeEntityName("BrowserStack, Inc.")).toBe("browserstack");
		expect(normalizeEntityName("Acme (formerly Beta) Ltd")).toBe("acme");
	});
});

describe("resolveEntities", () => {
	it("preserves exact matches over larger fuzzy matches", async () => {
		const { query, calls } = entityQuery([
			{
				company_id: "2",
				name: "Acme Services",
				name_lower: "acme services",
				employee_count: 900,
			},
			{
				company_id: "1",
				name: "Acme, Inc.",
				name_lower: "acme, inc.",
				employee_count: 500,
			},
		]);

		await expect(resolveEntities(["acme"], query)).resolves.toEqual({
			entities: [{ id: "1", name: "Acme, Inc." }],
			fuzzy: false,
		});
		expect(calls).toHaveLength(1);
		expect(calls[0]?.options).toEqual({
			stage: "company resolution",
			actionableErrors: true,
			maxExecutionSeconds: 60,
			retryTimeouts: false,
		});
	});

	it("preserves leading-article exact matches", async () => {
		let calls = 0;
		const query: LinkedInQuery = async <Row>(
			_query,
			params,
		): Promise<Row[]> => {
			calls += 1;
			if (!Object.values(params).includes("%acme%")) return [];
			return [
				{
					company_id: "1",
					name: "The Acme",
					name_lower: "the acme",
					employee_count: 500,
				},
			] as Row[];
		};

		await expect(resolveEntities(["acme"], query)).resolves.toEqual({
			entities: [{ id: "1", name: "The Acme" }],
			fuzzy: false,
		});
		expect(calls).toBe(1);
	});

	it("preserves the fuzzy fallback", async () => {
		const { query, calls } = entityQuery([
			{
				company_id: "3",
				name: "Acme Research",
				name_lower: "acme research",
				employee_count: 300,
			},
		]);

		await expect(resolveEntities(["acme"], query)).resolves.toEqual({
			entities: [{ id: "3", name: "Acme Research" }],
			fuzzy: true,
		});
		expect(calls).toHaveLength(1);
	});
});

describe("linkedinQueryWithClient", () => {
	it("uses one continuous timeout attempt and names the failed stage", async () => {
		let attempts = 0;
		const clickhouse = {
			query: async () => {
				attempts += 1;
				throw new Error(
					"Timeout exceeded: elapsed 60001 ms, maximum: 60000 ms",
				);
			},
		} as unknown as Parameters<typeof linkedinQueryWithClient>[0];

		await expect(
			linkedinQueryWithClient(
				clickhouse,
				"SELECT 1",
				{},
				{
					stage: "profile hydration",
					actionableErrors: true,
					maxExecutionSeconds: 60,
					retryTimeouts: false,
				},
			),
		).rejects.toThrow("LinkedIn profile hydration timed out after 60 seconds.");
		expect(attempts).toBe(1);
	});

	it("keeps a safe ClickHouse code in an actionable GTM error", async () => {
		const clickhouse = {
			query: async () => {
				throw Object.assign(new Error("Unsafe query detail"), { code: 47 });
			},
		} as unknown as Parameters<typeof linkedinQueryWithClient>[0];

		await expect(
			linkedinQueryWithClient(
				clickhouse,
				"SELECT 1",
				{},
				{
					stage: "profile hydration",
					actionableErrors: true,
					retryTimeouts: false,
				},
			),
		).rejects.toThrow(
			"LinkedIn profile hydration failed with ClickHouse code 47.",
		);
	});

	it("preserves the original error contract for discovery queries", async () => {
		const failure = Object.assign(new Error("Existing discovery detail"), {
			code: 47,
		});
		const clickhouse = {
			query: async () => {
				throw failure;
			},
		} as unknown as Parameters<typeof linkedinQueryWithClient>[0];

		await expect(
			linkedinQueryWithClient(
				clickhouse,
				"SELECT 1",
				{},
				{ stage: "discovery query", retryTimeouts: false },
			),
		).rejects.toBe(failure);
	});
});

describe("hydrateProfiles", () => {
	it("uses one continuous 60-second query for every requested profile", async () => {
		const calls: { options: Parameters<LinkedInQuery>[2] }[] = [];
		const query: LinkedInQuery = async <Row>(
			_query,
			_params,
			options,
		): Promise<Row[]> => {
			calls.push({ options });
			return [
				{ id: 1, full_name: "Ada Lovelace", experience: [] },
				{ id: 2, full_name: "Grace Hopper", experience: [] },
			] as Row[];
		};

		const profiles = await hydrateProfiles(["1", "2"], query);

		expect([...profiles.keys()]).toEqual(["1", "2"]);
		expect(calls).toEqual([
			{
				options: {
					stage: "profile hydration",
					actionableErrors: true,
					maxExecutionSeconds: 60,
					retryTimeouts: false,
				},
			},
		]);
	});
});

describe("dedupeByName", () => {
	it("keeps the freshest profile for a repeated human", () => {
		const rows = [
			{
				fullName: "Balaji Uppili",
				title: "Chief Business Officer",
				asOf: new Date("2026-02-13"),
			},
			{
				fullName: "Balaji  Uppili",
				title: "Chief Business Officer",
				asOf: new Date("2026-03-03"),
			},
			{ fullName: "Someone Else", title: "CTO", asOf: null },
		];
		const { kept, dropped } = dedupeByName(rows);
		expect(dropped).toBe(1);
		expect(kept).toHaveLength(2);
		expect(kept.find((row) => row.fullName.startsWith("Balaji"))?.asOf).toEqual(
			new Date("2026-03-03"),
		);
	});

	it("keeps two different humans who share a name", () => {
		const rows = [
			{
				fullName: "John Smith",
				title: "VP Engineering",
				asOf: new Date("2026-01-01"),
			},
			{
				fullName: "John Smith",
				title: "Director of Sales",
				asOf: new Date("2026-06-01"),
			},
		];
		expect(dedupeByName(rows).kept).toHaveLength(2);
	});

	it("folds accents and merges abbreviation-variant titles", () => {
		const rows = [
			{ fullName: "José García", title: "CTO", asOf: new Date("2026-01-01") },
			{
				fullName: "Jose Garcia",
				title: "Chief Technology Officer",
				asOf: new Date("2026-02-01"),
			},
			{ fullName: "李伟", title: "CIO", asOf: null },
			{ fullName: "李伟", title: "CIO", asOf: null },
		];
		const { kept } = dedupeByName(rows);
		expect(kept.filter((row) => row.fullName.includes("Gar"))).toHaveLength(1);
		expect(kept.filter((row) => row.title === "CIO")).toHaveLength(1);
	});

	it("prefers the still-current profile over a fresher departed twin", () => {
		const rows = [
			{
				fullName: "Priya Rao",
				title: "CTO",
				asOf: new Date("2026-03-01"),
				left: true,
			},
			{
				fullName: "Priya Rao",
				title: "CTO",
				asOf: new Date("2026-01-01"),
				left: false,
			},
		];
		const { kept } = dedupeByName(rows);
		expect(kept).toHaveLength(1);
		expect(kept[0]?.left).toBe(false);
	});
});

describe("parseOrgAnalysis", () => {
	const ids = new Set(["1", "2", "3"]);

	it("reads keep, function, seniority and reportsTo", () => {
		const parsed = parseOrgAnalysis(
			`Here you go: [
				{"id": "1", "keep": true, "function": "Executive", "seniority": 1, "reportsTo": null},
				{"id": "2", "keep": true, "function": "Engineering", "seniority": 2, "reportsTo": "1"},
				{"id": "3", "keep": false, "function": "Other", "seniority": 8, "reportsTo": "1"}
			]`,
			ids,
		);
		expect(parsed.get("1")).toEqual({
			keep: true,
			orgFunction: "Executive",
			seniorityRank: 1,
			reportsTo: null,
		});
		expect(parsed.get("2")?.reportsTo).toBe("1");
		expect(parsed.get("3")?.keep).toBe(false);
	});

	it("rejects unknown ids, bad functions and self-reports", () => {
		const parsed = parseOrgAnalysis(
			`[
				{"id": "1", "keep": true, "function": "Wizardry", "seniority": 99, "reportsTo": "1"},
				{"id": "9", "keep": true, "function": "IT", "seniority": 2, "reportsTo": null},
				{"id": "2", "keep": true, "function": "IT", "seniority": 4, "reportsTo": "9"}
			]`,
			ids,
		);
		expect(parsed.get("1")).toEqual({
			keep: true,
			orgFunction: "Other",
			seniorityRank: 8,
			reportsTo: null,
		});
		expect(parsed.has("9")).toBe(false);
		expect(parsed.get("2")?.reportsTo).toBe(null);
	});

	it("breaks reporting cycles", () => {
		const parsed = parseOrgAnalysis(
			`[
				{"id": "1", "keep": true, "function": "IT", "seniority": 2, "reportsTo": "2"},
				{"id": "2", "keep": true, "function": "IT", "seniority": 3, "reportsTo": "1"}
			]`,
			ids,
		);
		const cycled = [parsed.get("1")?.reportsTo, parsed.get("2")?.reportsTo];
		expect(cycled).toContain(null);
	});

	it("returns empty on junk", () => {
		expect(parseOrgAnalysis("no json", ids).size).toBe(0);
		expect(parseOrgAnalysis("[{broken", ids).size).toBe(0);
	});
});

describe("parseVerifyAnswer", () => {
	it("reads the three answers", () => {
		expect(parseVerifyAnswer('{"current": true, "evidence": "x"}')).toBe(
			"current",
		);
		expect(parseVerifyAnswer('{"current": false, "evidence": "x"}')).toBe(
			"left",
		);
		expect(parseVerifyAnswer('{"current": "unsure"}')).toBe("unsure");
	});

	it("defaults to unsure on junk", () => {
		expect(parseVerifyAnswer("no json here")).toBe("unsure");
		expect(parseVerifyAnswer("{broken")).toBe("unsure");
		expect(parseVerifyAnswer("")).toBe("unsure");
	});

	it("finds the JSON inside prose", () => {
		expect(
			parseVerifyAnswer('Based on my search: {"current": false} — they left.'),
		).toBe("left");
	});
});

describe("nameCandidates", () => {
	it("uses the name and the domain root", () => {
		expect(nameCandidates("Neurealm", "neurealm.com")).toEqual(["neurealm"]);
		expect(nameCandidates("Blue Yonder", "blueyonder.com")).toEqual([
			"blue yonder",
			"blueyonder",
		]);
	});

	it("skips a missing domain and short roots", () => {
		expect(nameCandidates("Acme", null)).toEqual(["acme"]);
		expect(nameCandidates("HP Inc", "hp.com")).toEqual(["hp inc"]);
	});
});

describe("parseCrawlDate", () => {
	it("reads a ClickHouse timestamp as UTC", () => {
		const parsed = parseCrawlDate("2026-01-12 08:30:00");
		expect(parsed?.toISOString()).toBe("2026-01-12T08:30:00.000Z");
	});

	it("returns null for empty and epoch values", () => {
		expect(parseCrawlDate(null)).toBeNull();
		expect(parseCrawlDate("")).toBeNull();
		expect(parseCrawlDate("1970-01-01 00:00:00")).toBeNull();
	});
});

describe("gtmPeopleOutcome", () => {
	it("reports the reason when the run stopped early", () => {
		expect(
			gtmPeopleOutcome({
				saved: 0,
				tier1: 0,
				tier2: 0,
				entities: 0,
				truncated: false,
				reason: "No such company.",
			}),
		).toBe("No such company.");
	});

	it("reports counts and truncation", () => {
		expect(
			gtmPeopleOutcome({
				saved: 42,
				tier1: 12,
				tier2: 30,
				entities: 3,
				truncated: true,
			}),
		).toBe(
			"Saved 42 people (12 Tier 1, 30 Tier 2) from 3 LinkedIn entities. More matched than were kept.",
		);
	});

	it("says when nothing matched", () => {
		expect(
			gtmPeopleOutcome({
				saved: 0,
				tier1: 0,
				tier2: 0,
				entities: 1,
				truncated: false,
			}),
		).toBe("No leadership titles matched across 1 LinkedIn entity.");
	});
});
