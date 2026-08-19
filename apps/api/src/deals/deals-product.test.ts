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
			dealCreateInput.safeParse({ ...requiredDeal, product: "visibility" })
				.success,
		).toBe(true);
	});

	it("accepts only fixed product values", () => {
		expect(
			dealCreateInput.safeParse({ ...requiredDeal, product: "unknown" })
				.success,
		).toBe(false);
		expect(dealUpdateInput.safeParse({ product: null }).success).toBe(false);
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
