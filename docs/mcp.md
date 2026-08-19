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
- `crm:write` permits record, activity, task, and relationship changes.
- `crm:agents` permits research and full custom-agent management.
- `crm:delete` permits permanent record and agent deletion.
- `crm:admin` permits custom-field management for workspace administrators.
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

Read access provides CRM search, records, timelines, communications, tasks,
dashboard totals, users, custom fields, workspace context, and LinkedIn discovery.
Communication detail includes full recordings, summaries, next steps, and
transcripts.

Deal lists accept a product filter.

Valid values are `visibility`, `relay`, `sidekick`, `unspecified`, and `all`.

The workspace context contains Oximy's narrative, offering, buyers, and
differentiation.

Owners and administrators edit this profile under Settings → General.

LinkedIn tools query the optional ClickHouse capability through the agent.

They return source identifiers, timestamps, URLs, bounded results, and cursors.

They never enrich, score, match identities, or write CRM records.

Company resolution returns ranked candidates.

Agents must confirm an ambiguous candidate before using its identifier.

Write access provides record creation, updates, bulk changes, enrichment,
ownership, company moves, primary contacts, deal contacts, activities,
communication resolution, and task completion.

Agent access provides agent configuration, history, activity, files, guided
creation, revision, deployment, lifecycle management, runs, retries, and
cancellation. Agent creation uses the same builder and review flow as the app.

Delete access provides activity deletion and individual or bulk record
deletion. It also permits agent deletion when the token has agent access.

Administrative access provides custom-field creation, updates, ordering,
archival, restoration, and backfills. The server also requires an owner or
administrator workspace role. Permanent field deletion also requires delete
access.

Deal creation requires at least one product. Deal updates cannot clear the
complete product selection.

The MCP has no import tool. Connected systems create and update records through
the normal tools. This path preserves CRM validation, events, and agent queues.

Every tool returns both response forms.

- `content[0].text` contains JSON for older clients.
- `structuredContent.result` contains the same JSON-compatible value.

The Oximy context and LinkedIn discovery tools publish explicit output schemas.

All existing OAuth scopes and tool names remain unchanged.

## Optional LinkedIn configuration

The agent reads these root environment variables:

- `LINKEDIN_CLICKHOUSE_HOST`
- `LINKEDIN_CLICKHOUSE_PORT`
- `LINKEDIN_CLICKHOUSE_USER`
- `LINKEDIN_CLICKHOUSE_PASSWORD`
- `LINKEDIN_CLICKHOUSE_DATABASE`

The host enables the capability.

Missing configuration returns an unavailable result.

It never crashes the API or removes the MCP tools.

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
