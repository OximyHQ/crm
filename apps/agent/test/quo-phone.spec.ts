import { describe, expect, it } from "bun:test";
import { normalizeQuoPhone } from "../agent/lib/quo-phone";

describe("Quo phone normalization", () => {
	it("normalizes North American numbers", () => {
		expect(normalizeQuoPhone("(415) 555-0100")).toBe("+14155550100");
		expect(normalizeQuoPhone("1-415-555-0100")).toBe("+14155550100");
	});

	it("preserves an international E.164 country code", () => {
		expect(normalizeQuoPhone("+44 20 7946 0958")).toBe("+442079460958");
	});

	it("rejects incomplete numbers", () => {
		expect(normalizeQuoPhone("555-0100")).toBeNull();
		expect(normalizeQuoPhone(null)).toBeNull();
	});
});
