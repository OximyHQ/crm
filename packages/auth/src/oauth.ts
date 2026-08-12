import { env } from "./env";
import { WORKSPACE_ID } from "./organization";

export const MCP_SCOPES = {
	read: "crm:read",
	write: "crm:write",
	agents: "crm:agents",
} as const;

export const OAUTH_SCOPES = [
	"openid",
	"profile",
	"email",
	"offline_access",
	MCP_SCOPES.read,
	MCP_SCOPES.write,
	MCP_SCOPES.agents,
] as const;

export const OAUTH_ISSUER = new URL("/api/auth", env.apiUrl).toString();
export const MCP_RESOURCE_URL = new URL("/api/mcp", env.appUrl).toString();

export const oauthClientReference = () => WORKSPACE_ID;
