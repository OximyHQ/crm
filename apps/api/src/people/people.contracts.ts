import { z } from "zod";

export const personListInput = z.object({
	companyId: z.string(),
});

export type PersonListInput = z.infer<typeof personListInput>;

export const personIdInput = z.object({ id: z.string() });

export const personCompanyInput = z.object({ companyId: z.string() });

export const personProfileSchema = z.object({
	headline: z.string().nullable().catch(null),
	asOf: z.string().nullable().catch(null),
	experiences: z
		.array(
			z.object({
				title: z.string().catch(""),
				company: z.string().catch(""),
				companyId: z.string().nullable().catch(null),
				from: z.string().nullable().catch(null),
				to: z.string().nullable().catch(null),
				current: z.boolean().catch(false),
			}),
		)
		.catch([]),
});

export type PersonProfile = z.infer<typeof personProfileSchema>;

export function parsePersonProfile(value: unknown): PersonProfile | null {
	if (!value || typeof value !== "object") return null;
	const parsed = personProfileSchema.safeParse(value);
	return parsed.success ? parsed.data : null;
}
