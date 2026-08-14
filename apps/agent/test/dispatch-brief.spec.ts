import { describe, expect, it } from "bun:test";
import { brief } from "../agent/lib/dispatch";
import type { LeasedTask } from "../agent/lib/tasks";

const prospectingTask: LeasedTask = {
	id: "task-1",
	contactId: null,
	companyId: "company-1",
	dealId: null,
	kind: "company-prospecting",
	reason: "A rep requested enrichment.",
	payload: null,
	budget: 1,
	attempts: 1,
	priority: 1,
	dueAt: new Date("2026-08-14T00:00:00.000Z"),
};

describe("company prospecting brief", () => {
	it("starts prospecting without repeating company research", () => {
		const prompt = brief(prospectingTask);

		expect(prompt).toContain("Load prospecting immediately");
		expect(prompt).toContain("Do not research the company again");
		expect(prompt).toContain("Do not write a company brief");
		expect(prompt).toContain("call add_prospect_contacts");
	});
});
