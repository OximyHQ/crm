import { randomUUID } from "node:crypto";
import {
	isWorkspaceAdmin,
	toWorkspaceRole,
	WORKSPACE_ID,
	type WorkspaceRole,
} from "@crm/auth";
import type { Db } from "@crm/db";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import type { JWTPayload } from "jose";
import { z } from "zod";
import {
	activityCreateInput,
	completeInput,
	myTasksInput,
	timelineCountsInput,
	timelineInput,
} from "../activities/activities.contracts";
import { ActivitiesService } from "../activities/activities.service";
import { AgentDefinitionsService } from "../agent/agent-definitions.service";
import { AgentRunsService } from "../agent/agent-runs.service";
import {
	agentCancelRunInput,
	agentDeployInput,
	agentHistoryInput,
	agentRetryRunInput,
	agentReviseInput,
	agentSaveFileInput,
	agentUpdateInput,
} from "../agent/agents.contracts";
import {
	communicationListInput,
	communicationResolveInput,
} from "../communications/communications.contracts";
import { CommunicationsService } from "../communications/communications.service";
import {
	companyBulkInput,
	companyBulkOwnerInput,
	companyCreateInput,
	companyListInput,
	companyUpdateArgs,
	companyUpdateInput,
	setPrimaryContactInput,
} from "../companies/companies.contracts";
import { CompaniesService } from "../companies/companies.service";
import {
	contactBulkCompanyInput,
	contactBulkInput,
	contactBulkOwnerInput,
	contactCreateInput,
	contactListInput,
	contactUpdateArgs,
	contactUpdateInput,
	factDecisionInput,
} from "../contacts/contacts.contracts";
import { ContactsService } from "../contacts/contacts.service";
import { builderConversationCreateInput } from "../conversations/conversations.contracts";
import { ConversationsService } from "../conversations/conversations.service";
import { runBulk } from "../crm/bulk";
import { dashboardSummaryInput } from "../dashboard/dashboard.contracts";
import { DashboardService } from "../dashboard/dashboard.service";
import { InjectDatabase } from "../database/database.constants";
import {
	dealAttachContactInput,
	dealBulkInput,
	dealBulkOwnerInput,
	dealBulkStageInput,
	dealContactRoleInput,
	dealCreateInput,
	dealDetachContactInput,
	dealListInput,
	dealUpdateArgs,
	dealUpdateInput,
	setStageInput,
} from "../deals/deals.contracts";
import { DealsService } from "../deals/deals.service";
import {
	fieldByKeyInput,
	fieldCreateInput,
	fieldIdInput,
	fieldListInput,
	fieldReorderInput,
	fieldUpdateArgs,
} from "../fields/fields.contracts";
import { FieldsService } from "../fields/fields.service";
import { SearchService } from "../search/search.service";
import { UsersService } from "../users/users.service";
import { toolGroupsFor } from "./mcp-scopes";

const id = z.object({ id: z.string().min(1) });
const list = z.object({
	q: z.string().default(""),
	page: z.number().int().min(1).default(1),
	pageSize: z.number().int().min(1).max(100).default(25),
});

const companyBulkUpdateInput = companyBulkInput.extend({
	data: companyUpdateInput,
});
const contactBulkUpdateInput = contactBulkInput.extend({
	data: contactUpdateInput,
});
const dealBulkUpdateInput = dealBulkInput.extend({ data: dealUpdateInput });
const agentCreationInput = builderConversationCreateInput
	.omit({ commandType: true, clientRequestId: true, attachments: true })
	.extend({ clientRequestId: z.uuid().optional() });
const agentQuestionInput = z
	.object({
		id: z.string().min(1),
		clientRequestId: z.uuid().optional(),
		requestId: z.string().trim().min(1).max(240),
		optionId: z.string().trim().min(1).max(160).optional(),
		text: z.string().trim().min(1).max(20_000).optional(),
	})
	.refine((input) => Boolean(input.optionId) !== Boolean(input.text), {
		message: "Choose one option or enter a written answer.",
	});
const agentDeployToolInput = agentDeployInput.extend({
	clientRequestId: z.uuid().optional(),
});
const agentRetryToolInput = agentRetryRunInput.extend({
	clientRequestId: z.uuid().optional(),
});
const agentReviseToolInput = agentReviseInput.extend({
	clientRequestId: z.uuid().optional(),
});
const agentSaveFileToolInput = agentSaveFileInput.extend({
	clientRequestId: z.uuid().optional(),
});

type Principal = {
	userId: string;
	role: WorkspaceRole;
	scopes: unknown;
};

@Injectable()
export class McpService {
	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly companies: CompaniesService,
		private readonly contacts: ContactsService,
		private readonly communications: CommunicationsService,
		private readonly deals: DealsService,
		private readonly activities: ActivitiesService,
		private readonly dashboard: DashboardService,
		private readonly fields: FieldsService,
		private readonly users: UsersService,
		private readonly search: SearchService,
		private readonly agents: AgentDefinitionsService,
		private readonly runs: AgentRunsService,
		private readonly conversations: ConversationsService,
	) {}

	async createServer(jwt: JWTPayload): Promise<McpServer> {
		const principal = await this.principal(jwt);
		const groups = toolGroupsFor(principal.scopes);
		const server = new McpServer({ name: "Oximy CRM", version: "1.0.0" });

		if (groups.read) this.registerReadTools(server, principal.userId);
		if (groups.write) this.registerWriteTools(server, principal.userId);
		if (groups.delete) this.registerDeleteTools(server);
		if (groups.agents) {
			this.registerAgentTools(server, principal.userId, groups.delete);
		}
		if (groups.admin && isWorkspaceAdmin(principal.role)) {
			this.registerAdminTools(server, groups.delete);
		}

		return server;
	}

	private async principal(jwt: JWTPayload): Promise<Principal> {
		const userId =
			typeof jwt.crm_user_id === "string" ? jwt.crm_user_id : jwt.sub;
		if (!userId)
			throw new UnauthorizedException("The access token has no user.");

		const membership = await this.db.member.findUnique({
			where: {
				organizationId_userId: { organizationId: WORKSPACE_ID, userId },
			},
			select: { id: true, role: true },
		});
		if (!membership)
			throw new UnauthorizedException("The CRM user is not active.");

		return {
			userId,
			role: toWorkspaceRole(membership.role),
			scopes: jwt.scope ?? jwt.scopes,
		};
	}

	private registerReadTools(server: McpServer, userId: string): void {
		server.registerTool(
			"search_crm",
			{
				description: "Search CRM companies, contacts, and deals by text.",
				inputSchema: z.object({ q: z.string().min(2) }),
				annotations: { readOnlyHint: true },
			},
			async ({ q }) => result(await this.search.quick(q)),
		);
		server.registerTool(
			"list_companies",
			{
				description: "List and search CRM companies.",
				inputSchema: list,
				annotations: { readOnlyHint: true },
			},
			async (input) =>
				result(
					await this.companies.list(
						companyListInput.parse({ ...input, sort: "", dir: "asc" }),
					),
				),
		);
		server.registerTool(
			"get_company",
			{
				description:
					"Get one CRM company with contacts, deals, fields, and activity context.",
				inputSchema: id,
				annotations: { readOnlyHint: true },
			},
			async ({ id }) => result(await this.companies.byId(id)),
		);
		server.registerTool(
			"list_contacts",
			{
				description: "List and search CRM contacts.",
				inputSchema: list,
				annotations: { readOnlyHint: true },
			},
			async (input) =>
				result(
					await this.contacts.list(
						contactListInput.parse({ ...input, sort: "", dir: "asc" }),
					),
				),
		);
		server.registerTool(
			"get_contact",
			{
				description:
					"Get one CRM contact with company, deals, fields, and relationship context.",
				inputSchema: id,
				annotations: { readOnlyHint: true },
			},
			async ({ id }) => result(await this.contacts.byId(id)),
		);
		server.registerTool(
			"list_communications",
			{
				description:
					"List CRM calls and messages. Results include participants and review status, but omit full transcripts.",
				inputSchema: communicationListInput,
				annotations: { readOnlyHint: true },
			},
			async (input) => result(await this.communications.list(input)),
		);
		server.registerTool(
			"search_communications",
			{
				description:
					"Search CRM calls, messages, participants, phone numbers, summaries, and transcripts.",
				inputSchema: communicationListInput.extend({ q: z.string().min(1) }),
				annotations: { readOnlyHint: true },
			},
			async (input) => result(await this.communications.list(input)),
		);
		server.registerTool(
			"get_communication",
			{
				description:
					"Get one CRM communication with full recordings, summary, next steps, and transcript.",
				inputSchema: id,
				annotations: { readOnlyHint: true },
			},
			async ({ id }) => result(await this.communications.byId(id)),
		);
		server.registerTool(
			"list_deals",
			{
				description: "List and search CRM deals.",
				inputSchema: list,
				annotations: { readOnlyHint: true },
			},
			async (input) =>
				result(
					await this.deals.list(
						dealListInput.parse({ ...input, sort: "", dir: "asc" }),
					),
				),
		);
		server.registerTool(
			"get_deal",
			{
				description:
					"Get one CRM deal with company, contacts, fields, and stage context.",
				inputSchema: id,
				annotations: { readOnlyHint: true },
			},
			async ({ id }) => result(await this.deals.byId(id)),
		);
		server.registerTool(
			"list_users",
			{
				description: "List CRM users available as record and deal owners.",
				inputSchema: z.object({}),
				annotations: { readOnlyHint: true },
			},
			async () => result(await this.users.list()),
		);
		server.registerTool(
			"list_fields",
			{
				description:
					"List custom CRM fields for companies, contacts, or deals.",
				inputSchema: fieldListInput,
				annotations: { readOnlyHint: true },
			},
			async ({ entity, includeArchived }) =>
				result(await this.fields.list(entity, includeArchived)),
		);
		server.registerTool(
			"get_custom_field",
			{
				description: "Get one custom CRM field by entity and key.",
				inputSchema: fieldByKeyInput,
				annotations: { readOnlyHint: true },
			},
			async ({ entity, key }) => result(await this.fields.byKey(entity, key)),
		);
		server.registerTool(
			"get_custom_field_coverage",
			{
				description:
					"Read the filled-record coverage for one custom CRM field.",
				inputSchema: fieldIdInput,
				annotations: { readOnlyHint: true },
			},
			async ({ id }) => result(await this.fields.coverage(id)),
		);
		server.registerTool(
			"get_dashboard_summary",
			{
				description: "Read CRM dashboard totals and pipeline metrics.",
				inputSchema: dashboardSummaryInput,
				annotations: { readOnlyHint: true },
			},
			async (input) => result(await this.dashboard.summary(userId, input)),
		);
		server.registerTool(
			"get_activity_timeline",
			{
				description: "Read the activity timeline for CRM records.",
				inputSchema: timelineInput,
				annotations: { readOnlyHint: true },
			},
			async (input) => result(await this.activities.timeline(input)),
		);
		server.registerTool(
			"get_activity_timeline_counts",
			{
				description: "Read activity counts for CRM records.",
				inputSchema: timelineCountsInput,
				annotations: { readOnlyHint: true },
			},
			async (input) => result(await this.activities.timelineCounts(input)),
		);
		server.registerTool(
			"list_my_tasks",
			{
				description: "List CRM tasks assigned to the current user.",
				inputSchema: myTasksInput,
				annotations: { readOnlyHint: true },
			},
			async (input) => result(await this.activities.myTasks(input, userId)),
		);
	}

	private registerWriteTools(server: McpServer, userId: string): void {
		server.registerTool(
			"create_company",
			{
				description: "Create one CRM company.",
				inputSchema: companyCreateInput,
				annotations: { readOnlyHint: false, idempotentHint: false },
			},
			async (input) => result(await this.companies.create(input)),
		);
		server.registerTool(
			"update_company",
			{
				description: "Update one CRM company.",
				inputSchema: companyUpdateArgs,
				annotations: { readOnlyHint: false, idempotentHint: true },
			},
			async ({ id, data }) => result(await this.companies.update(id, data)),
		);
		server.registerTool(
			"create_contact",
			{
				description: "Create one CRM contact.",
				inputSchema: contactCreateInput,
				annotations: { readOnlyHint: false, idempotentHint: false },
			},
			async (input) => result(await this.contacts.create(input)),
		);
		server.registerTool(
			"resolve_communication",
			{
				description:
					"Attach an unresolved communication number to a contact, or ignore one communication.",
				inputSchema: communicationResolveInput,
				annotations: { readOnlyHint: false, idempotentHint: true },
			},
			async (input) => result(await this.communications.resolve(input)),
		);
		server.registerTool(
			"update_contact",
			{
				description: "Update one CRM contact.",
				inputSchema: contactUpdateArgs,
				annotations: { readOnlyHint: false, idempotentHint: true },
			},
			async ({ id, data }) => result(await this.contacts.update(id, data)),
		);
		server.registerTool(
			"create_deal",
			{
				description: "Create one CRM deal. Use list_users to choose its owner.",
				inputSchema: dealCreateInput,
				annotations: { readOnlyHint: false, idempotentHint: false },
			},
			async (input) => result(await this.deals.create(input)),
		);
		server.registerTool(
			"update_deal",
			{
				description: "Update one CRM deal.",
				inputSchema: dealUpdateArgs,
				annotations: { readOnlyHint: false, idempotentHint: true },
			},
			async ({ id, data }) => result(await this.deals.update(id, data)),
		);
		server.registerTool(
			"set_deal_stage",
			{
				description: "Move one CRM deal to a new stage.",
				inputSchema: setStageInput,
				annotations: { readOnlyHint: false, idempotentHint: true },
			},
			async (input) => result(await this.deals.setStage(input, userId)),
		);
		server.registerTool(
			"attach_contact_to_deal",
			{
				description: "Attach a company contact to one CRM deal.",
				inputSchema: dealAttachContactInput,
				annotations: { readOnlyHint: false, idempotentHint: true },
			},
			async (input) => result(await this.deals.attachContact(input)),
		);
		server.registerTool(
			"bulk_update_companies",
			{
				description: "Apply the same changes to multiple CRM companies.",
				inputSchema: companyBulkUpdateInput,
				annotations: { readOnlyHint: false, idempotentHint: true },
			},
			async ({ ids, data }) =>
				result(await runBulk(ids, (id) => this.companies.update(id, data))),
		);
		server.registerTool(
			"bulk_assign_company_owner",
			{
				description: "Assign multiple CRM companies to one owner.",
				inputSchema: companyBulkOwnerInput,
				annotations: { readOnlyHint: false, idempotentHint: true },
			},
			async (input) => result(await this.companies.bulkAssignOwner(input)),
		);
		server.registerTool(
			"bulk_enrich_companies",
			{
				description: "Queue direct enrichment for multiple CRM companies.",
				inputSchema: companyBulkInput,
				annotations: { readOnlyHint: false, idempotentHint: true },
			},
			async ({ ids }) => result(await this.companies.bulkEnrich(ids)),
		);
		server.registerTool(
			"enrich_company",
			{
				description: "Queue direct company enrichment without full research.",
				inputSchema: id,
				annotations: { readOnlyHint: false, idempotentHint: true },
			},
			async ({ id }) => result(await this.companies.enrich(id)),
		);
		server.registerTool(
			"set_company_primary_contact",
			{
				description: "Set or clear one company's primary contact.",
				inputSchema: setPrimaryContactInput,
				annotations: { readOnlyHint: false, idempotentHint: true },
			},
			async ({ companyId, contactId }) =>
				result(await this.companies.setPrimaryContact(companyId, contactId)),
		);
		server.registerTool(
			"bulk_update_contacts",
			{
				description: "Apply the same changes to multiple CRM contacts.",
				inputSchema: contactBulkUpdateInput,
				annotations: { readOnlyHint: false, idempotentHint: true },
			},
			async ({ ids, data }) =>
				result(await runBulk(ids, (id) => this.contacts.update(id, data))),
		);
		server.registerTool(
			"bulk_assign_contact_owner",
			{
				description: "Assign multiple CRM contacts to one owner.",
				inputSchema: contactBulkOwnerInput,
				annotations: { readOnlyHint: false, idempotentHint: true },
			},
			async (input) => result(await this.contacts.bulkAssignOwner(input)),
		);
		server.registerTool(
			"bulk_move_contacts",
			{
				description: "Move multiple CRM contacts to one company or no company.",
				inputSchema: contactBulkCompanyInput,
				annotations: { readOnlyHint: false, idempotentHint: true },
			},
			async (input) => result(await this.contacts.bulkSetCompany(input)),
		);
		server.registerTool(
			"bulk_enrich_contacts",
			{
				description: "Queue enrichment for multiple CRM contacts.",
				inputSchema: contactBulkInput,
				annotations: { readOnlyHint: false, idempotentHint: true },
			},
			async ({ ids }) => result(await this.contacts.bulkEnrich(ids)),
		);
		server.registerTool(
			"decide_contact_fact",
			{
				description: "Approve or reject one researched contact fact.",
				inputSchema: factDecisionInput,
				annotations: { readOnlyHint: false, idempotentHint: false },
			},
			async (input) => result(await this.contacts.decideFact(input, userId)),
		);
		server.registerTool(
			"detach_contact_from_deal",
			{
				description: "Detach one CRM contact from one deal.",
				inputSchema: dealDetachContactInput,
				annotations: { readOnlyHint: false, idempotentHint: false },
			},
			async (input) => result(await this.deals.detachContact(input)),
		);
		server.registerTool(
			"set_deal_contact_role",
			{
				description: "Change one contact's role on one CRM deal.",
				inputSchema: dealContactRoleInput,
				annotations: { readOnlyHint: false, idempotentHint: true },
			},
			async (input) => result(await this.deals.setContactRole(input)),
		);
		server.registerTool(
			"bulk_update_deals",
			{
				description: "Apply the same changes to multiple CRM deals.",
				inputSchema: dealBulkUpdateInput,
				annotations: { readOnlyHint: false, idempotentHint: true },
			},
			async ({ ids, data }) =>
				result(await runBulk(ids, (id) => this.deals.update(id, data))),
		);
		server.registerTool(
			"bulk_assign_deal_owner",
			{
				description: "Assign multiple CRM deals to one owner.",
				inputSchema: dealBulkOwnerInput,
				annotations: { readOnlyHint: false, idempotentHint: true },
			},
			async (input) => result(await this.deals.bulkAssignOwner(input)),
		);
		server.registerTool(
			"bulk_set_deal_stage",
			{
				description: "Move multiple CRM deals to one stage.",
				inputSchema: dealBulkStageInput,
				annotations: { readOnlyHint: false, idempotentHint: true },
			},
			async (input) => result(await this.deals.bulkSetStage(input, userId)),
		);
		server.registerTool(
			"create_activity",
			{
				description: "Create a CRM note, call, email, meeting, or task.",
				inputSchema: activityCreateInput,
				annotations: { readOnlyHint: false, idempotentHint: false },
			},
			async (input) => result(await this.activities.create(input, userId)),
		);
		server.registerTool(
			"complete_task",
			{
				description: "Complete or reopen one CRM task.",
				inputSchema: completeInput,
				annotations: { readOnlyHint: false, idempotentHint: true },
			},
			async ({ id, completed }) =>
				result(await this.activities.complete(id, completed)),
		);
	}

	private registerDeleteTools(server: McpServer): void {
		server.registerTool(
			"delete_activity",
			{
				description: "Delete one CRM activity.",
				inputSchema: id,
				annotations: { readOnlyHint: false, destructiveHint: true },
			},
			async ({ id: activityId }) =>
				result(await this.activities.delete(activityId)),
		);
		server.registerTool(
			"delete_company",
			{
				description: "Delete one CRM company.",
				inputSchema: id,
				annotations: { readOnlyHint: false, destructiveHint: true },
			},
			async ({ id }) => result(await this.companies.delete(id)),
		);
		server.registerTool(
			"bulk_delete_companies",
			{
				description: "Delete multiple CRM companies.",
				inputSchema: companyBulkInput,
				annotations: { readOnlyHint: false, destructiveHint: true },
			},
			async ({ ids }) => result(await this.companies.bulkDelete(ids)),
		);
		server.registerTool(
			"delete_contact",
			{
				description: "Delete one CRM contact.",
				inputSchema: id,
				annotations: { readOnlyHint: false, destructiveHint: true },
			},
			async ({ id }) => result(await this.contacts.delete(id)),
		);
		server.registerTool(
			"bulk_delete_contacts",
			{
				description: "Delete multiple CRM contacts.",
				inputSchema: contactBulkInput,
				annotations: { readOnlyHint: false, destructiveHint: true },
			},
			async ({ ids }) => result(await this.contacts.bulkDelete(ids)),
		);
		server.registerTool(
			"delete_deal",
			{
				description: "Delete one CRM deal.",
				inputSchema: id,
				annotations: { readOnlyHint: false, destructiveHint: true },
			},
			async ({ id }) => result(await this.deals.delete(id)),
		);
		server.registerTool(
			"bulk_delete_deals",
			{
				description: "Delete multiple CRM deals.",
				inputSchema: dealBulkInput,
				annotations: { readOnlyHint: false, destructiveHint: true },
			},
			async ({ ids }) => result(await this.deals.bulkDelete(ids)),
		);
	}

	private registerAgentTools(
		server: McpServer,
		userId: string,
		canDelete: boolean,
	): void {
		server.registerTool(
			"research_company",
			{
				description: "Queue fresh company research through the Eve agent.",
				inputSchema: id,
				annotations: { readOnlyHint: false, idempotentHint: true },
			},
			async ({ id }) => result(await this.companies.research(id, userId)),
		);
		server.registerTool(
			"research_contact",
			{
				description: "Queue fresh contact research through the Eve agent.",
				inputSchema: id,
				annotations: { readOnlyHint: false, idempotentHint: true },
			},
			async ({ id }) => result(await this.contacts.enrich(id)),
		);
		server.registerTool(
			"list_agents",
			{
				description: "List custom CRM agents available to the current user.",
				inputSchema: z.object({}),
				annotations: { readOnlyHint: true },
			},
			async () => result(await this.agents.list(userId)),
		);
		server.registerTool(
			"start_agent_run",
			{
				description: "Start one deployed CRM agent through Eve.",
				inputSchema: id,
				annotations: { readOnlyHint: false, idempotentHint: false },
			},
			async ({ id }) =>
				result(
					await this.runs.runNow({ id, clientRequestId: randomUUID() }, userId),
				),
		);
		server.registerTool(
			"get_agent",
			{
				description: "Read one CRM agent's configuration.",
				inputSchema: id,
				annotations: { readOnlyHint: true },
			},
			async ({ id }) => result(await this.agents.byId(id, userId)),
		);
		server.registerTool(
			"list_agent_runs",
			{
				description: "Read one CRM agent's run history and results.",
				inputSchema: agentHistoryInput,
				annotations: { readOnlyHint: true },
			},
			async ({ id, limit }) => result(await this.runs.list(id, limit, userId)),
		);
		server.registerTool(
			"list_agent_activity",
			{
				description: "Read one CRM agent's activity history.",
				inputSchema: agentHistoryInput,
				annotations: { readOnlyHint: true },
			},
			async ({ id, limit }) =>
				result(await this.runs.activity(id, limit, userId)),
		);
		server.registerTool(
			"list_agent_files",
			{
				description: "Read one CRM agent's files.",
				inputSchema: id,
				annotations: { readOnlyHint: true },
			},
			async ({ id }) => result(await this.agents.files(id, userId)),
		);
		server.registerTool(
			"create_agent_draft",
			{
				description: "Start the guided builder workflow for a new CRM agent.",
				inputSchema: agentCreationInput,
				annotations: { readOnlyHint: false, idempotentHint: false },
			},
			async ({ clientRequestId, ...input }) =>
				result(
					await this.conversations.createBuilder(
						{
							...input,
							attachments: [],
							commandType: "CREATE_AGENT",
							clientRequestId: clientRequestId ?? randomUUID(),
						},
						userId,
					),
				),
		);
		server.registerTool(
			"get_agent_creation",
			{
				description:
					"Read a guided agent creation workflow and its review state.",
				inputSchema: id,
				annotations: { readOnlyHint: true },
			},
			async ({ id }) =>
				result(await this.conversations.builderById(id, userId)),
		);
		server.registerTool(
			"answer_agent_creation_question",
			{
				description: "Answer one question in a guided agent creation workflow.",
				inputSchema: agentQuestionInput,
				annotations: { readOnlyHint: false, idempotentHint: false },
			},
			async ({ clientRequestId, ...input }) =>
				result(
					await this.conversations.answerBuilderQuestion(
						{
							...input,
							clientRequestId: clientRequestId ?? randomUUID(),
						},
						userId,
					),
				),
		);
		server.registerTool(
			"update_agent",
			{
				description: "Update one CRM agent's name and description.",
				inputSchema: agentUpdateInput,
				annotations: { readOnlyHint: false, idempotentHint: true },
			},
			async (input) => result(await this.agents.update(input, userId)),
		);
		server.registerTool(
			"save_agent_file",
			{
				description: "Save one file in a CRM agent's draft version.",
				inputSchema: agentSaveFileToolInput,
				annotations: { readOnlyHint: false, idempotentHint: true },
			},
			async ({ clientRequestId, ...input }) =>
				result(
					await this.agents.saveFile(
						{ ...input, clientRequestId: clientRequestId ?? randomUUID() },
						userId,
					),
				),
		);
		server.registerTool(
			"revise_agent",
			{
				description: "Start a guided revision for one CRM agent.",
				inputSchema: agentReviseToolInput,
				annotations: { readOnlyHint: false, idempotentHint: false },
			},
			async ({ clientRequestId, ...input }) =>
				result(
					await this.agents.revise(
						{ ...input, clientRequestId: clientRequestId ?? randomUUID() },
						userId,
					),
				),
		);
		server.registerTool(
			"deploy_agent",
			{
				description: "Deploy one reviewed CRM agent version.",
				inputSchema: agentDeployToolInput,
				annotations: { readOnlyHint: false, idempotentHint: true },
			},
			async ({ clientRequestId, ...input }) =>
				result(
					await this.agents.deploy(
						{ ...input, clientRequestId: clientRequestId ?? randomUUID() },
						userId,
					),
				),
		);
		this.registerAgentStateTools(server, userId);
		server.registerTool(
			"retry_agent_run",
			{
				description: "Retry one failed CRM agent run.",
				inputSchema: agentRetryToolInput,
				annotations: { readOnlyHint: false, idempotentHint: false },
			},
			async ({ clientRequestId, ...input }) =>
				result(
					await this.runs.retryRun(
						{ ...input, clientRequestId: clientRequestId ?? randomUUID() },
						userId,
					),
				),
		);
		server.registerTool(
			"cancel_agent_run",
			{
				description: "Cancel one queued or active CRM agent run.",
				inputSchema: agentCancelRunInput,
				annotations: { readOnlyHint: false, idempotentHint: true },
			},
			async (input) => result(await this.runs.cancelRun(input, userId)),
		);
		if (canDelete) {
			server.registerTool(
				"delete_agent",
				{
					description: "Delete one archived CRM agent.",
					inputSchema: id,
					annotations: { readOnlyHint: false, destructiveHint: true },
				},
				async ({ id }) => result(await this.agents.remove(id, userId)),
			);
		}
	}

	private registerAgentStateTools(server: McpServer, userId: string): void {
		server.registerTool(
			"pause_agent",
			{
				description: "Pause one deployed CRM agent.",
				inputSchema: id,
				annotations: { readOnlyHint: false, idempotentHint: true },
			},
			async ({ id }) => result(await this.agents.pause(id, userId)),
		);
		server.registerTool(
			"resume_agent",
			{
				description: "Resume one paused CRM agent.",
				inputSchema: id,
				annotations: { readOnlyHint: false, idempotentHint: true },
			},
			async ({ id }) => result(await this.agents.resume(id, userId)),
		);
		server.registerTool(
			"archive_agent",
			{
				description: "Archive one CRM agent.",
				inputSchema: id,
				annotations: { readOnlyHint: false, destructiveHint: true },
			},
			async ({ id }) => result(await this.agents.archive(id, userId)),
		);
		server.registerTool(
			"restore_agent",
			{
				description: "Restore one archived CRM agent.",
				inputSchema: id,
				annotations: { readOnlyHint: false, idempotentHint: true },
			},
			async ({ id }) => result(await this.agents.restore(id, userId)),
		);
	}

	private registerAdminTools(server: McpServer, canDelete: boolean): void {
		server.registerTool(
			"create_custom_field",
			{
				description: "Create one CRM custom-field definition.",
				inputSchema: fieldCreateInput,
				annotations: { readOnlyHint: false, idempotentHint: false },
			},
			async (input) => result(await this.fields.create(input)),
		);
		server.registerTool(
			"update_custom_field",
			{
				description: "Update one CRM custom-field definition.",
				inputSchema: fieldUpdateArgs,
				annotations: { readOnlyHint: false, idempotentHint: true },
			},
			async ({ id, data }) => result(await this.fields.update(id, data)),
		);
		server.registerTool(
			"reorder_custom_fields",
			{
				description: "Set the display order for CRM custom fields.",
				inputSchema: fieldReorderInput,
				annotations: { readOnlyHint: false, idempotentHint: true },
			},
			async (input) => result(await this.fields.reorder(input)),
		);
		server.registerTool(
			"archive_custom_field",
			{
				description: "Archive one CRM custom-field definition.",
				inputSchema: fieldIdInput,
				annotations: { readOnlyHint: false, destructiveHint: true },
			},
			async ({ id }) => result(await this.fields.archive(id)),
		);
		server.registerTool(
			"restore_custom_field",
			{
				description: "Restore one archived CRM custom-field definition.",
				inputSchema: fieldIdInput,
				annotations: { readOnlyHint: false, idempotentHint: true },
			},
			async ({ id }) => result(await this.fields.restore(id)),
		);
		server.registerTool(
			"backfill_custom_field",
			{
				description: "Queue an agent backfill for one CRM custom field.",
				inputSchema: fieldIdInput,
				annotations: { readOnlyHint: false, idempotentHint: true },
			},
			async ({ id }) => result(await this.fields.backfill(id)),
		);
		if (canDelete) {
			server.registerTool(
				"delete_custom_field",
				{
					description: "Permanently delete one archived CRM custom field.",
					inputSchema: fieldIdInput,
					annotations: { readOnlyHint: false, destructiveHint: true },
				},
				async ({ id }) => result(await this.fields.delete(id)),
			);
		}
	}
}

function result(value: unknown) {
	return {
		content: [
			{
				type: "text" as const,
				text: JSON.stringify(value, (_, nested) =>
					typeof nested === "bigint" ? nested.toString() : nested,
				),
			},
		],
	};
}
