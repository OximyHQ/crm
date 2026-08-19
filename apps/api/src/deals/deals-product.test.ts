import { describe, expect, it } from "bun:test";
import {
	dealCreateInput,
	dealListInput,
	dealUpdateInput,
} from "./deals.contracts";

const requiredDeal = {
	name: "Acme opportunity",
	companyId: "company-1",
	ownerId: "user-1",
};

describe("Deal product contracts", () => {
	it("requires a product for new deals", () => {
		expect(dealCreateInput.safeParse(requiredDeal).success).toBe(false);
		expect(
			dealCreateInput.safeParse({ ...requiredDeal, products: ["visibility"] })
				.success,
		).toBe(true);
	});

	it("accepts unique fixed products", () => {
		expect(
			dealCreateInput.safeParse({ ...requiredDeal, products: ["unknown"] })
				.success,
		).toBe(false);
		expect(dealUpdateInput.safeParse({ products: [] }).success).toBe(false);
		expect(
			dealUpdateInput.safeParse({ products: ["relay", "relay"] }).success,
		).toBe(false);
		expect(
			dealUpdateInput.safeParse({ products: ["relay", "sidekick"] }).success,
		).toBe(true);
		expect(
			dealCreateInput.parse({
				...requiredDeal,
				products: ["sidekick", "visibility"],
			}).products,
		).toEqual(["visibility", "sidekick"]);
	});

	it("supports all product filters", () => {
		for (const product of [
			"all",
			"visibility",
			"relay",
			"sidekick",
			"unspecified",
		]) {
			expect(dealListInput.safeParse({ product }).success).toBe(true);
		}
	});
});
