import { z } from "zod";

export const prospectListInput = z.object({
	companyId: z.string(),
});

export type ProspectListInput = z.infer<typeof prospectListInput>;

export const prospectIdInput = z.object({ id: z.string() });

export const prospectCompanyInput = z.object({ companyId: z.string() });

export const prospectProfileSchema = z.object({
	headline: z.string().nullable().catch(null),
	asOf: z.string().nullable().catch(null),
	experiences: z
		.array(
			z.object({
				title: z.string().catch(""),
				company: z.string().catch(""),
				from: z.string().nullable().catch(null),
				to: z.string().nullable().catch(null),
				current: z.boolean().catch(false),
			}),
		)
		.catch([]),
});

export type ProspectProfile = z.infer<typeof prospectProfileSchema>;

export function parseProspectProfile(value: unknown): ProspectProfile | null {
	if (!value || typeof value !== "object") return null;
	const parsed = prospectProfileSchema.safeParse(value);
	return parsed.success ? parsed.data : null;
}
