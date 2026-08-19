import { z } from "zod";

export const OXIMY_PRODUCTS = ["visibility", "relay", "sidekick"] as const;

export const OXIMY_PRODUCT_LABELS = {
	visibility: "Visibility",
	relay: "Relay",
	sidekick: "Sidekick",
} as const;

export const oximyProduct = z.enum(OXIMY_PRODUCTS);

export const oximyProducts = z
	.array(oximyProduct)
	.min(1, "Choose at least one product.")
	.max(OXIMY_PRODUCTS.length)
	.refine((products) => new Set(products).size === products.length, {
		message: "Choose each product once.",
	})
	.transform((products) =>
		OXIMY_PRODUCTS.filter((product) => products.includes(product)),
	);

export type OximyProduct = z.infer<typeof oximyProduct>;

export const productContextInput = z.object({});

export const linkedinPeopleSearchInput = z
	.object({
		name: z.string().trim().min(1).max(200).optional(),
		currentTitle: z.string().trim().min(1).max(200).optional(),
		currentCompanyName: z.string().trim().min(1).max(200).optional(),
		currentCompanyId: z
			.string()
			.trim()
			.regex(/^\d+$/, "Use a LinkedIn company identifier.")
			.optional(),
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
			Boolean(
				input.currentCompanyName ||
					input.currentCompanyId ||
					input.city ||
					input.country,
			),
		{
			message:
				"Add a current company, city, or country to keep the search bounded.",
		},
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
	country: z.string().trim().min(1).max(120),
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

export const productContextResult = z.object({
	ok: z.literal(true),
	name: z.string(),
	website: z.string().nullable(),
	profile: z
		.object({
			narrative: z.string(),
			sells: z.string().nullable(),
			sellsTo: z.string().nullable(),
			edge: z.string().nullable(),
			sourceUrl: z.string().nullable(),
			refreshedAt: z.string(),
		})
		.nullable(),
});

export const linkedinPersonSummary = z.object({
	id: z.string(),
	idKind: z.enum(["profile", "company_employee"]),
	fullName: z.string(),
	headline: z.string().nullable(),
	linkedInUrl: z.string().nullable(),
	location: z.string().nullable(),
	country: z.string().nullable(),
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

export const GTM_FUNCTIONS = [
	"Executive",
	"Engineering",
	"IT",
	"Security",
	"Data & AI",
	"Other",
] as const;

export type GtmOrgFunction = (typeof GTM_FUNCTIONS)[number];
