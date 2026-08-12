import { MCP_RESOURCE_URL, MCP_SCOPES, OAUTH_ISSUER } from "@crm/auth";

export function GET() {
	return Response.json(
		{
			resource: MCP_RESOURCE_URL,
			resource_name: "Oximy CRM",
			authorization_servers: [OAUTH_ISSUER],
			scopes_supported: [MCP_SCOPES.read, MCP_SCOPES.write, MCP_SCOPES.agents],
			bearer_methods_supported: ["header"],
		},
		{
			headers: {
				"access-control-allow-origin": "*",
				"cache-control": "public, max-age=300",
			},
		},
	);
}
