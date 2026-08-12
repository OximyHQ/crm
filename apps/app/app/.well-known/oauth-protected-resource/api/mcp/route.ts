import { MCP_RESOURCE_URL, MCP_SCOPES } from "@crm/auth";
import { z } from "zod";
import { API_URL } from "@/lib/env";

const authorizationMetadata = z.object({ issuer: z.string().url() });

export async function GET() {
	const upstream = await fetch(
		`${API_URL}/api/auth/.well-known/oauth-authorization-server`,
	);
	const { issuer } = authorizationMetadata.parse(await upstream.json());

	return Response.json(
		{
			resource: MCP_RESOURCE_URL,
			resource_name: "Oximy CRM",
			authorization_servers: [issuer],
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
