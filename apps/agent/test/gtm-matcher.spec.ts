import { describe, expect, it } from "bun:test";
import { GTM_UNMATCHED_RANK } from "../agent/lib/gtm-config";
import {
	buildCoarseRankSql,
	matchTitle,
	seniorityRankOf,
} from "../agent/lib/gtm-matcher";

describe("seniorityRankOf", () => {
	it("orders founder, c-suite, evp/svp, vp, head, director", () => {
		expect(seniorityRankOf("Co-founder and CEO")).toBe(1);
		expect(seniorityRankOf("Chief Technology Officer")).toBe(2);
		expect(seniorityRankOf("SVP Engineering")).toBe(3);
		expect(seniorityRankOf("Vice President of Products")).toBe(4);
		expect(seniorityRankOf("Head of Platform")).toBe(5);
		expect(seniorityRankOf("Director of Security Operations")).toBe(6);
		expect(seniorityRankOf("Software Engineer")).toBe(GTM_UNMATCHED_RANK);
	});

	it("keeps a vice president out of the president rank", () => {
		expect(seniorityRankOf("Vice President of Sales")).toBe(4);
		expect(seniorityRankOf("President")).toBe(1);
	});

	it("keeps office staff out of the founder and c-suite ranks", () => {
		expect(seniorityRankOf("Senior Lead - CEO's Office")).toBe(
			GTM_UNMATCHED_RANK,
		);
		expect(seniorityRankOf("Founders Office")).toBe(GTM_UNMATCHED_RANK);
	});

	it("matches on word boundaries, not raw substrings", () => {
		expect(seniorityRankOf("Sociology Professor")).toBe(GTM_UNMATCHED_RANK);
		expect(seniorityRankOf("Executor of Estates")).toBe(GTM_UNMATCHED_RANK);
	});
});

describe("matchTitle (no-key fallback)", () => {
	it("keeps leadership through VP and drops the rest", () => {
		expect(matchTitle("Chief Information Officer")).toEqual({
			tier: 1,
			orgFunction: "Other",
			seniorityRank: 2,
		});
		expect(matchTitle("VP of Engineering")).toEqual({
			tier: 2,
			orgFunction: "Other",
			seniorityRank: 4,
		});
		expect(matchTitle("Head of Platform")).toBeNull();
		expect(matchTitle("Senior Software Engineer")).toBeNull();
	});

	it("excludes assistants and manager-suffixed acronym titles", () => {
		expect(matchTitle("Executive Assistant to President & COO")).toBeNull();
		expect(matchTitle("CTO Sr Manager")).toBeNull();
	});
});

describe("buildCoarseRankSql", () => {
	it("emits a multiIf mapping markers to ranks", () => {
		const sql = buildCoarseRankSql("title");
		expect(sql.startsWith("multiIf(")).toBe(true);
		expect(sql.endsWith(`, ${GTM_UNMATCHED_RANK})`)).toBe(true);
		expect(sql).toContain(
			"match(lowerUTF8(title), '(^|[^a-z0-9])cto($|[^a-z0-9])'), 2",
		);
		expect(sql).toContain("position(lowerUTF8(title), 'head of') > 0, 5");
	});

	it("orders longer phrases before their substrings", () => {
		const sql = buildCoarseRankSql("title");
		const vice = sql.indexOf("'vice president'");
		const president = sql.indexOf("(^|[^a-z0-9])president($|[^a-z0-9])");
		expect(vice).toBeGreaterThan(-1);
		expect(president).toBeGreaterThan(-1);
		expect(vice).toBeLessThan(president);
	});

	it("refuses an empty column expression", () => {
		expect(() => buildCoarseRankSql(" ")).toThrow();
	});
});
