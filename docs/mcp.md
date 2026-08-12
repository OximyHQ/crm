# CRM MCP

The CRM serves a remote Streamable HTTP MCP endpoint at `/api/mcp`.
The public production URL is `https://crm.oximy.com/api/mcp`.

## Authentication

Google remains the upstream sign-in provider. Better Auth serves as the OAuth
2.1 authorization server for MCP clients. MCP clients never receive Google
access tokens.

The authorization server supports dynamic public-client registration,
authorization code with PKCE S256, consent, and refresh tokens.

The protected resource publishes these scopes:

- `crm:read` permits CRM search and record reads.
- `crm:write` permits company, contact, and deal writes.
- `crm:agents` permits Eve research and custom agent runs.
- `offline_access` permits refresh tokens.

The server validates the exact `/api/mcp` audience. It also verifies active
workspace membership on every MCP connection.

## Discovery

- Protected resource metadata:
  `/.well-known/oauth-protected-resource/api/mcp`
- Authorization server metadata:
  `/.well-known/oauth-authorization-server/api/auth`
- OpenID metadata:
  `/api/auth/.well-known/openid-configuration`
- Dynamic client registration:
  `/api/auth/oauth2/register`

## Tools

Read access provides CRM search, lists, records, users, and custom fields.
Write access provides company, contact, deal, stage, and deal-contact changes.
Agent access queues research or starts a deployed custom agent through Eve.

The MCP has no import tool. Connected systems create and update records through
the normal tools. This path preserves CRM validation, events, and agent queues.

## Client setup

Use this remote server URL:

```text
https://crm.oximy.com/api/mcp
```

An OAuth-capable MCP client discovers registration and authorization from the
metadata endpoints. The first connection opens the CRM consent screen.

## Cost

CRM reads and writes add no model cost. OAuth adds only small database and HTTP
work. Research and custom agent tools use the configured Eve model and external
research providers. Their existing budgets remain the cost controls.
