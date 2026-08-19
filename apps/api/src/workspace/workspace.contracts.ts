import { WORKSPACE_ROLES } from "@crm/auth";
import { MAX_LINE, MAX_NARRATIVE, MAX_SLUG } from "@crm/db/workspace";
import { z } from "zod";
import { listInput } from "../trpc/list-input";

export const memberListInput = listInput.extend({
	role: z.string().default("all"),
});

export type MemberListInput = z.infer<typeof memberListInput>;

export const updateWorkspaceInput = z.object({
	name: z.string().trim().min(1).max(120),
	website: z.string().trim().min(1).max(255),
	slug: z
		.string()
		.trim()
		.min(1)
		.max(MAX_SLUG)
		.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
		.optional(),
});

export const updateWorkspaceProfileInput = z.object({
	narrative: z.string().trim().min(40).max(MAX_NARRATIVE),
	sells: z.string().trim().max(MAX_LINE),
	sellsTo: z.string().trim().max(MAX_LINE),
	edge: z.string().trim().max(MAX_LINE),
});

export const setMemberRoleInput = z.object({
	memberId: z.string().min(1),
	role: z.enum(WORKSPACE_ROLES),
});

export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceInput>;
export type UpdateWorkspaceProfileInput = z.infer<
	typeof updateWorkspaceProfileInput
>;
export type SetMemberRoleInput = z.infer<typeof setMemberRoleInput>;
