import { describe, expect, it } from "bun:test";
import {
	gtmPeopleOutcome,
	nameCandidates,
	parseCrawlDate,
} from "../agent/lib/gtm-report";

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
