import { randomUUID } from "node:crypto";
import { WORKSPACE_ID } from "@crm/auth";
import { type Db, type FieldEntity } from "@crm/db";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import type { JWTPayload } from "jose";
import { z } from "zod";
import { AgentDefinitionsService } from "../agent/agent-definitions.service";
import { AgentRunsService } from "../agent/agent-runs.service";
import {
	companyCreateInput,
	companyListInput,
	companyUpdateArgs,
} from "../companies/companies.contracts";
import { CompaniesService } from "../companies/companies.service";
import {
	contactCreateInput,
	contactListInput,
	contactUpdateArgs,
} from "../contacts/contacts.contracts";
import { ContactsService } from "../contacts/contacts.service";
import { InjectDatabase } from "../database/database.constants";
import {
	dealAttachContactInput,
	dealCreateInput,
	dealListInput,
	dealUpdateArgs,
	setStageInput,
} from "../deals/deals.contracts";
import { DealsService } from "../deals/deals.service";
import { FieldsService } from "../fields/fields.service";
import { SearchService } from "../search/search.service";
import { UsersService } from "../users/users.service";
import { toolGroupsFor } from "./mcp-scopes";

const entity = z.enum(["COMPANY", "CONTACT", "DEAL"]);
const id = z.object({ id: z.string().min(1) });
const list = z.object({
	q: z.string().default(""),
	page: z.number().int().min(1).default(1),
	pageSize: z.number().int().min(1).max(100).default(25),
});

type Principal = { userId: string; scopes: unknown };

@Injectable()
export class McpService {
	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly companies: CompaniesService,
		private readonly contacts: ContactsService,
		private readonly deals: DealsService,
		private readonly fields: FieldsService,
		private readonly users: UsersService,
		private readonly search: SearchService,
		private readonly agents: AgentDefinitionsService,
		private readonly runs: AgentRunsService,
	) {}

	async createServer(jwt: JWTPayload): Promise<McpServer> {
		const principal = await this.principal(jwt);
		const groups = toolGroupsFor(principal.scopes);
		const server = new McpServer({ name: "Oximy CRM", version: "1.0.0" });

		if (groups.read) this.registerReadTools(server);
		if (groups.write) this.registerWriteTools(server, principal.userId);
		if (groups.agents) this.registerAgentTools(server, principal.userId);

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
			select: { id: true },
		});
		if (!membership)
			throw new UnauthorizedException("The CRM user is not active.");

		return { userId, scopes: jwt.scope ?? jwt.scopes };
	}

	private registerReadTools(server: McpServer): void {
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
				inputSchema: z.object({ entity }),
				annotations: { readOnlyHint: true },
			},
			async ({ entity }) =>
				result(await this.fields.list(entity as FieldEntity, false)),
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
	}

	private registerAgentTools(server: McpServer, userId: string): void {
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
