import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db, RecordSource } from "@crm/db";
import { addProspects } from "../agent/lib/prospecting";

const suffix = crypto.randomUUID();
const domain = `prospecting-${suffix}.example.test`;
const userId = `prospecting-user-${suffix}`;
let companyId = "";

const readIdentity = async () => ({
	name: "Prospecting CRM",
	website: "https://seller.example.test",
	profile: {
		website: "https://seller.example.test",
		narrative: "Sales intelligence for enterprise AI teams.",
		sections: {
			sells: "AI adoption intelligence",
			sellsTo: "Enterprise teams scaling AI programs",
		},
		sourceUrl: "https://seller.example.test",
		refreshedAt: new Date("2026-08-14T00:00:00.000Z"),
	},
});

beforeAll(async () => {
	await db.user.create({
		data: {
			id: userId,
			name: "Prospecting Test",
			email: `${userId}@example.test`,
		},
	});
	const company = await db.company.create({
		data: {
			name: "Target Systems",
			domain,
			website: `https://${domain}`,
			ownerId: userId,
		},
		select: { id: true },
	});
	companyId = company.id;
});

afterAll(async () => {
	await db.contact.deleteMany({ where: { companyId } });
	await db.company.deleteMany({ where: { id: companyId } });
	await db.user.deleteMany({ where: { id: userId } });
});

describe("company prospecting", () => {
	it("creates sourced ICP contacts once and leaves engagement empty", async () => {
		const profile = "https://www.linkedin.com/in/avery-patel";
		const input = {
			companyId,
			companyFit: "The company runs an enterprise AI program.",
			companyFitSourceUrl: `https://${domain}/ai-program`,
			candidates: [
				{
					name: "Avery Patel",
					title: "VP AI Transformation",
					relevance: "Owns enterprise AI rollout and adoption.",
					sourceUrl: profile,
					linkedinUrl: profile,
				},
				{
					name: "Unsupported Person",
					title: "Advisor",
					relevance: "No direct operating responsibility.",
					sourceUrl: "https://search.example.test/result",
				},
			],
		};

		const first = await addProspects(input, { readIdentity });
		expect(first.targetCustomer).toBe("Enterprise teams scaling AI programs");
		expect(first.created).toHaveLength(1);
		expect(first.skipped).toEqual([
			{
				name: "Unsupported Person",
				reason:
					"Use the employer's site or the person's LinkedIn profile as the source.",
			},
		]);

		const contact = await db.contact.findUniqueOrThrow({
			where: { id: first.created[0]?.id },
			select: {
				firstName: true,
				lastName: true,
				title: true,
				linkedinUrl: true,
				email: true,
				lastActivityAt: true,
				source: true,
				facts: {
					where: { status: "APPLIED" },
					select: { field: true, sourceUrl: true },
				},
			},
		});
		expect(contact).toMatchObject({
			firstName: "Avery",
			lastName: "Patel",
			title: "VP AI Transformation",
			linkedinUrl: profile,
			email: null,
			lastActivityAt: null,
			source: RecordSource.PROSPECTING,
		});
		expect(contact.facts.map((fact) => fact.field).sort()).toEqual([
			"linkedinUrl",
			"name",
			"title",
		]);
		expect(contact.facts.every((fact) => fact.sourceUrl === profile)).toBe(
			true,
		);

		const second = await addProspects(
			{
				...input,
				candidates: [{ ...input.candidates[0], sourceUrl: `${profile}/` }],
			},
			{ readIdentity },
		);
		expect(second.created).toHaveLength(0);
		expect(second.existing).toHaveLength(1);
		expect(await db.contact.count({ where: { companyId } })).toBe(1);
	});
});
