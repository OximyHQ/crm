import { describe, expect, it } from "bun:test";
import {
	departedPerProfile,
	gtmPeopleOutcome,
	nameCandidates,
	type ProfileExperience,
	parseCrawlDate,
	parseVerifyAnswer,
} from "../agent/lib/gtm-report";

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
