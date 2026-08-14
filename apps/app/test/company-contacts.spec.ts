import { describe, expect, it } from "bun:test";
import { companyContactsEmptyState } from "../lib/company-contacts";

describe("company contacts empty state", () => {
	it("shows contact research while enrichment runs", () => {
		expect(companyContactsEmptyState("Groww", true)).toEqual({
			title: "Researching contacts",
			description: "Checking public sources for relevant buyers and champions.",
			running: true,
		});
	});

	it("returns to the useful empty state after enrichment", () => {
		expect(companyContactsEmptyState("Groww", false)).toEqual({
			title: "No contacts yet",
			description:
				"People you engage and prospects you want to reach at Groww appear here.",
			running: false,
		});
	});
});
