import { z } from "zod";

export const OXIMY_PRODUCTS = ["visibility", "relay", "sidekick"] as const;

export const OXIMY_PRODUCT_LABELS = {
	visibility: "Visibility",
	relay: "Relay",
	sidekick: "Sidekick",
} as const;

export const OXIMY_PRODUCT_FIELD_KEY = "oximy_product";

export const oximyProduct = z.enum(OXIMY_PRODUCTS);

export type OximyProduct = z.infer<typeof oximyProduct>;

export const productContextInput = z.object({ product: oximyProduct });

export const linkedinPeopleSearchInput = z
	.object({
		name: z.string().trim().min(1).max(200).optional(),
		currentTitle: z.string().trim().min(1).max(200).optional(),
		currentCompanyName: z.string().trim().min(1).max(200).optional(),
		currentCompanyId: z.string().trim().min(1).max(40).optional(),
		pastCompany: z.string().trim().min(1).max(200).optional(),
		city: z.string().trim().min(1).max(120).optional(),
		country: z.string().trim().min(1).max(120).optional(),
		skills: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
		companySizeMin: z.number().int().min(0).optional(),
		companySizeMax: z.number().int().min(0).optional(),
		cursor: z.string().trim().min(1).max(500).optional(),
		limit: z.number().int().min(1).max(100).default(25),
	})
	.refine(
		(input) =>
			Boolean(
				input.name ||
					input.currentTitle ||
					input.currentCompanyName ||
					input.currentCompanyId ||
					input.pastCompany ||
					input.city ||
					input.country ||
					input.skills?.length ||
					input.companySizeMin !== undefined ||
					input.companySizeMax !== undefined,
			),
		{ message: "Add at least one people search filter." },
	)
	.refine(
		(input) =>
			input.companySizeMin === undefined ||
			input.companySizeMax === undefined ||
			input.companySizeMin <= input.companySizeMax,
		{ message: "The minimum company size exceeds the maximum size." },
	);

export const linkedinPersonInput = z.object({
	personId: z
		.string()
		.trim()
		.regex(/^-?\d+$/, "Use a LinkedIn person identifier."),
});

export const linkedinCompanyResolutionInput = z.object({
	companyName: z.string().trim().min(1).max(200),
	limit: z.number().int().min(1).max(25).default(10),
});

export const linkedinCompanyEmployeesInput = z.object({
	companyId: z
		.string()
		.trim()
		.regex(/^\d+$/, "Use a LinkedIn company identifier."),
	currentTitle: z.string().trim().min(1).max(200).optional(),
	cursor: z.string().trim().min(1).max(500).optional(),
	limit: z.number().int().min(1).max(100).default(25),
});

export const unavailableAgentCapability = z.object({
	ok: z.literal(false),
	configured: z.boolean(),
	reason: z.string(),
});

export const productContextResult = z.union([
	z.object({
		ok: z.literal(true),
		configured: z.literal(true),
		product: oximyProduct,
		label: z.string(),
		markdown: z.string(),
	}),
	unavailableAgentCapability,
]);

export const linkedinPersonSummary = z.object({
	id: z.string(),
	fullName: z.string(),
	headline: z.string().nullable(),
	linkedInUrl: z.string().nullable(),
	location: z.string().nullable(),
	currentTitle: z.string().nullable(),
	currentCompany: z.string().nullable(),
	currentCompanyId: z.string().nullable(),
	companyEmployeeEstimate: z.number().nullable(),
	connectionsCount: z.number().nullable(),
});

export const linkedinPeopleSearchResult = z.union([
	z.object({
		ok: z.literal(true),
		configured: z.literal(true),
		source: z.literal("linkedin_clickhouse"),
		observedAt: z.string(),
		people: z.array(linkedinPersonSummary),
		nextCursor: z.string().nullable(),
		hasMore: z.boolean(),
	}),
	unavailableAgentCapability,
]);

const linkedinRole = z.object({
	title: z.string().nullable(),
	companyName: z.string().nullable(),
	companyId: z.string().nullable(),
	startedAt: z.string().nullable(),
	endedAt: z.string().nullable(),
});

export const linkedinPersonResult = z.union([
	z.object({
		ok: z.literal(true),
		configured: z.literal(true),
		source: z.literal("linkedin_clickhouse"),
		observedAt: z.string(),
		person: z
			.object({
				id: z.string(),
				fullName: z.string(),
				headline: z.string().nullable(),
				linkedInUrl: z.string().nullable(),
				location: z.string().nullable(),
				currentRoles: z.array(linkedinRole),
				recentWorkHistory: z.array(linkedinRole),
				education: z.array(z.string()),
				skills: z.array(z.string()),
				sourceTimestamp: z.string().nullable(),
			})
			.nullable(),
	}),
	unavailableAgentCapability,
]);

export const linkedinCompanyResolutionResult = z.union([
	z.object({
		ok: z.literal(true),
		configured: z.literal(true),
		source: z.literal("linkedin_clickhouse"),
		observedAt: z.string(),
		query: z.string(),
		candidates: z.array(
			z.object({
				id: z.string(),
				name: z.string(),
				employeeCount: z.number(),
				rank: z.number().int().positive(),
			}),
		),
	}),
	unavailableAgentCapability,
]);

export const linkedinCompanyEmployeesResult = z.union([
	z.object({
		ok: z.literal(true),
		configured: z.literal(true),
		source: z.literal("linkedin_clickhouse"),
		observedAt: z.string(),
		companyId: z.string(),
		employees: z.array(linkedinPersonSummary),
		nextCursor: z.string().nullable(),
		hasMore: z.boolean(),
	}),
	unavailableAgentCapability,
]);
