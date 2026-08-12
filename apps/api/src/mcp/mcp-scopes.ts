import { MCP_SCOPES } from "@crm/auth";

export type McpToolGroups = {
	read: boolean;
	write: boolean;
	agents: boolean;
};

export function toolGroupsFor(value: unknown): McpToolGroups {
	const scopes = new Set(
		(Array.isArray(value)
			? value
			: typeof value === "string"
				? value.split(" ")
				: []
		)
			.filter((scope): scope is string => typeof scope === "string")
			.map((scope) => scope.trim())
			.filter(Boolean),
	);

	return {
		read: scopes.has(MCP_SCOPES.read),
		write: scopes.has(MCP_SCOPES.write),
		agents: scopes.has(MCP_SCOPES.agents),
	};
}
