import { describe, expect, it } from "bun:test";
import { GTM_FUNCTION, GTM_UNMATCHED_TIER } from "../agent/lib/gtm-config";
import {
	buildCoarseTierSql,
	matchTitle,
	orgFunctionOf,
	seniorityRankOf,
	tierOf,
} from "../agent/lib/gtm-matcher";

describe("tierOf", () => {
	it("puts top decision-makers in tier 1", () => {
		expect(tierOf("Chief Information Officer")).toBe(1);
		expect(tierOf("CIO")).toBe(1);
		expect(tierOf("CTO & Co-Founder")).toBe(1);
		expect(tierOf("VP of Engineering")).toBe(1);
		expect(tierOf("Head of AI")).toBe(1);
		expect(tierOf("Head of Information Security")).toBe(1);
		expect(tierOf("Chief Executive Officer")).toBe(1);
	});

	it("puts departmental leaders in tier 2", () => {
		expect(tierOf("Director of IT")).toBe(2);
		expect(tierOf("Head of Information Technology")).toBe(2);
		expect(tierOf("Software Engineering Manager")).toBe(2);
		expect(tierOf("Chief of Staff")).toBe(2);
	});

	it("excludes everyone else", () => {
		expect(tierOf("Senior Software Engineer")).toBe(GTM_UNMATCHED_TIER);
		expect(tierOf("Staff Engineer")).toBe(GTM_UNMATCHED_TIER);
		expect(tierOf("Account Executive")).toBe(GTM_UNMATCHED_TIER);
		expect(tierOf("Recruiter")).toBe(GTM_UNMATCHED_TIER);
	});

	it("matches on word boundaries, not raw substrings", () => {
		expect(tierOf("Sociology Professor")).toBe(GTM_UNMATCHED_TIER);
		expect(tierOf("Executor of Estates")).toBe(GTM_UNMATCHED_TIER);
		expect(tierOf("Head of Iteration Planning")).toBe(GTM_UNMATCHED_TIER);
	});

	it("prefers the longest keyword", () => {
		expect(tierOf("Founders Office")).toBe(2);
		expect(tierOf("Founder")).toBe(1);
	});

	it("does not drag vice presidents into tier 1 via president", () => {
		expect(tierOf("Vice President of Sales")).toBe(GTM_UNMATCHED_TIER);
		expect(tierOf("President")).toBe(1);
	});
});

describe("orgFunctionOf", () => {
	it("classifies by ordered rules", () => {
		expect(orgFunctionOf("Chief Executive Officer")).toBe(
			GTM_FUNCTION.EXECUTIVE,
		);
		expect(orgFunctionOf("Chief Information Security Officer")).toBe(
			GTM_FUNCTION.SECURITY,
		);
		expect(orgFunctionOf("Head of Machine Learning")).toBe(
			GTM_FUNCTION.DATA_AI,
		);
		expect(orgFunctionOf("Director of Information Technology")).toBe(
			GTM_FUNCTION.IT,
		);
		expect(orgFunctionOf("VP of Engineering")).toBe(GTM_FUNCTION.ENGINEERING);
		expect(orgFunctionOf("Chief of Staff")).toBe(GTM_FUNCTION.EXECUTIVE);
	});
});

describe("seniorityRankOf", () => {
	it("orders founder, c-suite, svp, vp, head, director, manager", () => {
		expect(seniorityRankOf("Founder & CEO")).toBe(1);
		expect(seniorityRankOf("Chief Technology Officer")).toBe(2);
		expect(seniorityRankOf("SVP Engineering")).toBe(3);
		expect(seniorityRankOf("VP of Engineering")).toBe(4);
		expect(seniorityRankOf("Head of Platform")).toBe(5);
		expect(seniorityRankOf("Director of IT")).toBe(6);
		expect(seniorityRankOf("Software Engineering Manager")).toBe(7);
	});

	it("keeps a plain vice president out of the founder rank", () => {
		expect(seniorityRankOf("Vice President of Information Technology")).toBe(4);
	});
});

describe("matchTitle", () => {
	it("returns null for titles outside the ICP", () => {
		expect(matchTitle("Senior Software Engineer")).toBeNull();
	});

	it("returns tier, function and seniority together", () => {
		expect(matchTitle("Head of Developer Experience")).toEqual({
			tier: 1,
			orgFunction: GTM_FUNCTION.ENGINEERING,
			seniorityRank: 5,
		});
	});

	it("excludes assistants even when the title names an executive", () => {
		expect(matchTitle("Executive Assistant to President & COO")).toBeNull();
		expect(matchTitle("Assistant to the CTO")).toBeNull();
	});

	it("excludes managers who only carry a c-suite acronym", () => {
		expect(matchTitle("CTO Sr Manager")).toBeNull();
		expect(matchTitle("Software Engineering Manager")).toEqual({
			tier: 2,
			orgFunction: GTM_FUNCTION.ENGINEERING,
			seniorityRank: 7,
		});
	});
});

describe("buildCoarseTierSql", () => {
	it("emits a multiIf over the title column", () => {
		const sql = buildCoarseTierSql("title");
		expect(sql.startsWith("multiIf(")).toBe(true);
		expect(sql.endsWith(`, ${GTM_UNMATCHED_TIER})`)).toBe(true);
		expect(sql).toContain(
			"match(lowerUTF8(title), '(^|[^a-z0-9])cio($|[^a-z0-9])'), 1",
		);
		expect(sql).toContain(
			"position(lowerUTF8(title), 'chief information officer') > 0, 1",
		);
	});

	it("escapes quotes and refuses an empty column", () => {
		expect(() => buildCoarseTierSql(" ")).toThrow();
		expect(buildCoarseTierSql("title")).not.toContain("''");
	});

	it("inlines every tier keyword as an escaped literal", () => {
		const sql = buildCoarseTierSql("title");
		for (const keyword of [
			"chief information officer",
			"founders office",
			"director of engineering",
			"head of cloud",
		]) {
			expect(sql).toContain(`'${keyword}'`);
		}
	});
});
