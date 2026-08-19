import { describe, expect, it } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpService } from "./mcp.service";

const RETAINED_TOOL_NAMES = [
	"search_crm",
	"list_companies",
	"get_company",
	"list_contacts",
	"get_contact",
	"list_communications",
	"search_communications",
	"get_communication",
	"list_deals",
	"get_deal",
	"list_users",
	"list_fields",
	"get_custom_field",
	"get_custom_field_coverage",
	"get_dashboard_summary",
	"get_activity_timeline",
	"get_activity_timeline_counts",
	"list_my_tasks",
	"create_company",
	"update_company",
	"create_contact",
	"resolve_communication",
	"update_contact",
	"create_deal",
	"update_deal",
	"set_deal_stage",
	"attach_contact_to_deal",
	"bulk_update_companies",
	"bulk_assign_company_owner",
	"bulk_enrich_companies",
	"enrich_company",
	"set_company_primary_contact",
	"bulk_update_contacts",
	"bulk_assign_contact_owner",
	"bulk_move_contacts",
	"bulk_enrich_contacts",
	"decide_contact_fact",
	"detach_contact_from_deal",
	"set_deal_contact_role",
	"bulk_update_deals",
	"bulk_assign_deal_owner",
	"bulk_set_deal_stage",
	"create_activity",
	"complete_task",
	"delete_activity",
	"delete_company",
	"bulk_delete_companies",
	"delete_contact",
	"bulk_delete_contacts",
	"delete_deal",
	"bulk_delete_deals",
	"research_company",
	"research_contact",
	"list_agents",
	"start_agent_run",
	"get_agent",
	"list_agent_runs",
	"list_agent_activity",
	"list_agent_files",
	"create_agent_draft",
	"get_agent_creation",
	"answer_agent_creation_question",
	"update_agent",
	"save_agent_file",
	"revise_agent",
	"deploy_agent",
	"retry_agent_run",
	"cancel_agent_run",
	"delete_agent",
	"pause_agent",
	"resume_agent",
	"archive_agent",
	"restore_agent",
	"create_custom_field",
	"update_custom_field",
	"reorder_custom_fields",
	"archive_custom_field",
	"restore_custom_field",
	"backfill_custom_field",
	"delete_custom_field",
] as const;

describe("CRM MCP tools", () => {
	it("retains every existing tool and complete annotations", async () => {
		const client = await mcpClient(
			"crm:read crm:write crm:agents crm:delete crm:admin",
			"owner",
			[],
		);
		const response = await client.listTools();
		const names = new Set(response.tools.map((tool) => tool.name));

		for (const name of RETAINED_TOOL_NAMES) {
			expect(names.has(name)).toBe(true);
		}
		for (const tool of response.tools) {
			expect(tool.annotations?.readOnlyHint).toBeBoolean();
			expect(tool.annotations?.destructiveHint).toBeBoolean();
			expect(tool.annotations?.idempotentHint).toBeBoolean();
			expect(tool.annotations?.openWorldHint).toBeBoolean();
		}
	});

	it("exposes expanded read, write, agent, delete, and admin tools by scope", async () => {
		const read = await toolNames("crm:read");
		expect(read).toContain("get_dashboard_summary");
		expect(read).toContain("get_activity_timeline");
		expect(read).toContain("list_communications");
		expect(read).toContain("search_communications");
		expect(read).toContain("get_communication");
		expect(read).toContain("list_my_tasks");
		expect(read).toContain("get_oximy_product_context");
		expect(read).toContain("search_linkedin_people");
		expect(read).toContain("get_linkedin_person");
		expect(read).toContain("resolve_linkedin_company");
		expect(read).toContain("list_linkedin_company_employees");
		expect(read).not.toContain("delete_contact");

		const write = await toolNames("crm:write");
		expect(write).toContain("bulk_update_companies");
		expect(write).toContain("set_company_primary_contact");
		expect(write).toContain("detach_contact_from_deal");
		expect(write).toContain("create_activity");
		expect(write).toContain("resolve_communication");
		expect(write).not.toContain("search_linkedin_people");
		expect(write).not.toContain("delete_contact");

		const agents = await toolNames("crm:agents");
		expect(agents).toContain("get_agent");
		expect(agents).toContain("create_agent_draft");
		expect(agents).toContain("deploy_agent");
		expect(agents).toContain("retry_agent_run");
		expect(agents).not.toContain("delete_agent");

		const destructive = await toolNames("crm:delete crm:agents");
		expect(destructive).toContain("delete_activity");
		expect(destructive).toContain("delete_company");
		expect(destructive).toContain("bulk_delete_contacts");
		expect(destructive).toContain("delete_agent");

		const admin = await toolNames("crm:admin", "owner");
		expect(admin).toContain("create_custom_field");
		expect(admin).toContain("archive_custom_field");
		expect(admin).not.toContain("delete_custom_field");

		const adminDelete = await toolNames("crm:admin crm:delete", "admin");
		expect(adminDelete).toContain("delete_custom_field");

		const memberAdmin = await toolNames("crm:admin", "member");
		expect(memberAdmin).not.toContain("create_custom_field");
	});

	it("returns structured and text results for retained tools", async () => {
		const client = await mcpClient("crm:read", "owner", []);
		const response = await client.callTool({
			name: "list_users",
			arguments: {},
		});

		expect(response.structuredContent).toEqual({ result: { id: "result" } });
		expect(response.content).toEqual([
			{ type: "text", text: '{"id":"result"}' },
		]);
	});

	it("publishes complete annotations and schemas for new tools", async () => {
		const client = await mcpClient("crm:read", "owner", []);
		const tools = await client.listTools();
		const byName = new Map(tools.tools.map((tool) => [tool.name, tool]));

		expect(byName.get("search_crm")?.annotations).toEqual({
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		});
		expect(byName.get("search_linkedin_people")?.annotations).toEqual({
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: true,
		});
		expect(byName.get("search_linkedin_people")?.outputSchema).toBeDefined();
		expect(byName.get("get_oximy_product_context")?.outputSchema).toBeDefined();
	});

	it("routes mutations through existing services with actor context", async () => {
		const calls: Array<{ service: string; method: string; args: unknown[] }> =
			[];
		const client = await mcpClient(
			"crm:write crm:delete crm:agents crm:admin",
			"owner",
			calls,
		);

		await client.callTool({
			name: "bulk_update_companies",
			arguments: { ids: ["company-1", "company-2"], data: { industry: "AI" } },
		});
		await client.callTool({
			name: "create_activity",
			arguments: { type: "NOTE", body: "Follow up", companyId: "company-1" },
		});
		await client.callTool({
			name: "create_agent_draft",
			arguments: { message: "Track deal risks", resources: [] },
		});
		await client.callTool({
			name: "create_custom_field",
			arguments: { entity: "DEAL", label: "Risk", type: "TEXT" },
		});
		await client.callTool({
			name: "delete_contact",
			arguments: { id: "contact-1" },
		});
		await client.callTool({
			name: "delete_activity",
			arguments: { id: "activity-1" },
		});

		expect(
			calls.filter(
				(call) => call.service === "companies" && call.method === "update",
			),
		).toEqual([
			{
				service: "companies",
				method: "update",
				args: ["company-1", { industry: "AI" }],
			},
			{
				service: "companies",
				method: "update",
				args: ["company-2", { industry: "AI" }],
			},
		]);
		expect(calls).toContainEqual({
			service: "activities",
			method: "create",
			args: [
				{ type: "NOTE", body: "Follow up", companyId: "company-1" },
				"user",
			],
		});
		expect(calls).toContainEqual({
			service: "contacts",
			method: "delete",
			args: ["contact-1"],
		});
		expect(calls).toContainEqual({
			service: "activities",
			method: "delete",
			args: ["activity-1"],
		});
		const builderCall = calls.find(
			(call) =>
				call.service === "conversations" && call.method === "createBuilder",
		);
		expect(builderCall?.args[1]).toBe("user");
		expect(builderCall?.args[0]).toMatchObject({
			message: "Track deal risks",
			resources: [],
			attachments: [],
			commandType: "CREATE_AGENT",
			clientRequestId: expect.any(String),
		});
		expect(calls).toContainEqual({
			service: "fields",
			method: "create",
			args: [
				{
					entity: "DEAL",
					label: "Risk",
					type: "TEXT",
					options: [],
					agentFilled: true,
					agentBrief: null,
					required: false,
					showOnSheet: true,
					showOnTable: false,
				},
			],
		});
	});
});

async function toolNames(scopes: string, role = "owner"): Promise<string[]> {
	const client = await mcpClient(scopes, role, []);
	try {
		const tools = await client.listTools();
		return tools.tools.map((tool) => tool.name);
	} catch (error) {
		if (error instanceof Error && error.message.includes("Method not found")) {
			return [];
		}
		throw error;
	}
}

async function mcpClient(
	scopes: string,
	role: string,
	calls: Array<{ service: string; method: string; args: unknown[] }>,
): Promise<Client> {
	const dependency = (service: string) =>
		new Proxy(
			{},
			{
				get:
					(_target, property) =>
					async (...args: unknown[]) => {
						calls.push({ service, method: String(property), args });
						return { id: "result" };
					},
			},
		);
	const db = {
		member: {
			findUnique: async () => ({ id: "member", role }),
		},
	};
	const mcp = new McpService(
		db as never,
		dependency("companies") as never,
		dependency("contacts") as never,
		dependency("communications") as never,
		dependency("deals") as never,
		dependency("activities") as never,
		dependency("dashboard") as never,
		dependency("fields") as never,
		dependency("users") as never,
		dependency("search") as never,
		dependency("agents") as never,
		dependency("runs") as never,
		dependency("conversations") as never,
		dependency("agentBridge") as never,
	);
	const server = await mcp.createServer({ sub: "user", scope: scopes });
	const client = new Client({ name: "test", version: "1.0.0" });
	const [clientTransport, serverTransport] =
		InMemoryTransport.createLinkedPair();
	await server.connect(serverTransport);
	await client.connect(clientTransport);
	return client;
}
