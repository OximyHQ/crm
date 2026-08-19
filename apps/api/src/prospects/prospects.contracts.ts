import { z } from "zod";

export const prospectListInput = z.object({
	companyId: z.string(),
});

export type ProspectListInput = z.infer<typeof prospectListInput>;

export const prospectIdInput = z.object({ id: z.string() });

export const prospectCompanyInput = z.object({ companyId: z.string() });
