import { defineTool } from "eve/tools";
import { z } from "zod";
import { focusOn } from "../lib/focus";
import { addProspects } from "../lib/prospecting";
import { assertResearchPurpose } from "../lib/session-purpose";

export default defineTool({
	description:
		"Add up to three sourced prospect contacts at a company that clearly matches our stored target customer. Use only for current buyers or champions found on LinkedIn or the employer's site. These are prospecting records, not people we have engaged.",
	inputSchema: z.object({
		companyId: z.string(),
		companyFit: z
			.string()
			.trim()
			.min(1)
			.max(500)
			.describe("Why this company matches the target customer in our profile."),
		companyFitSourceUrl: z
			.url()
			.describe("A public HTTPS source supporting the company fit."),
		candidates: z
			.array(
				z.object({
					name: z.string().trim().min(2).max(160),
					title: z.string().trim().min(2).max(200),
					relevance: z
						.string()
						.trim()
						.min(1)
						.max(500)
						.describe("Why this role owns the problem, budget, or adoption."),
					sourceUrl: z
						.url()
						.describe("Their LinkedIn profile or employer team page."),
					linkedinUrl: z.url().optional(),
				}),
			)
			.min(1)
			.max(3),
	}),
	async execute(input, ctx) {
		assertResearchPurpose(ctx);
		focusOn({ companyId: input.companyId });
		return addProspects(input);
	},
});
