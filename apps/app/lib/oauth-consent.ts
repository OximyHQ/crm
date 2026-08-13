import { MCP_SCOPES } from "@crm/auth";

const DESCRIPTIONS: Record<string, string> = {
	[MCP_SCOPES.read]:
		"See your CRM companies, contacts, deals, users, and fields",
	[MCP_SCOPES.write]: "Create and update CRM companies, contacts, and deals",
	[MCP_SCOPES.agents]: "Start CRM research and agent runs through Eve",
	[MCP_SCOPES.delete]: "Delete CRM records and agents",
	[MCP_SCOPES.admin]: "Manage CRM custom fields",
	offline_access: "Keep this connection active until you disconnect it",
};

export function describeOAuthScopes(scopes: string): string[] {
	const requested = new Set(scopes.split(" ").map((scope) => scope.trim()));
	return [
		MCP_SCOPES.read,
		MCP_SCOPES.write,
		MCP_SCOPES.agents,
		MCP_SCOPES.delete,
		MCP_SCOPES.admin,
		"offline_access",
	]
		.filter((scope) => requested.has(scope))
		.map((scope) => DESCRIPTIONS[scope] as string);
}
