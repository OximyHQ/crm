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

Read access provides these tools:

- `get_oximy_product_context`
- `search_crm`
- `list_companies`
- `get_company`
- `list_contacts`
- `get_contact`
- `list_communications`
- `search_communications`
- `get_communication`
- `list_deals`
- `get_deal`
- `list_users`
- `list_fields`
- `get_custom_field`
- `get_custom_field_coverage`
- `get_dashboard_summary`
- `get_activity_timeline`
- `get_activity_timeline_counts`
- `list_my_tasks`
- `search_linkedin_people`
- `get_linkedin_person`
- `resolve_linkedin_company`
- `list_linkedin_company_employees`

`list_deals` accepts the `product` filter.

Valid values are `visibility`, `relay`, `sidekick`, `unspecified`, and `all`.

`get_oximy_product_context` returns the CRM workspace profile.

The profile contains Oximy's narrative, offering, buyers, and differentiation.

Owners and administrators edit this profile under Settings → General.

LinkedIn tools query the optional ClickHouse capability through the agent.

They return source identifiers, timestamps, URLs, bounded results, and cursors.

They never enrich, score, match identities, or write CRM records.

Company resolution returns ranked candidates.

Agents must confirm an ambiguous candidate before using its identifier.

Write access provides record creation, updates, bulk changes, enrichment,
ownership, company moves, primary contacts, deal contacts, activities,
communication resolution, and task completion.

Write access provides these tools:

- `create_company`
- `update_company`
- `create_contact`
- `resolve_communication`
- `update_contact`
- `create_deal`
- `update_deal`
- `set_deal_stage`
- `attach_contact_to_deal`
- `bulk_update_companies`
- `bulk_assign_company_owner`
- `bulk_enrich_companies`
- `enrich_company`
- `set_company_primary_contact`
- `bulk_update_contacts`
- `bulk_assign_contact_owner`
- `bulk_move_contacts`
- `bulk_enrich_contacts`
- `decide_contact_fact`
- `detach_contact_from_deal`
- `set_deal_contact_role`
- `bulk_update_deals`
- `bulk_assign_deal_owner`
- `bulk_set_deal_stage`
- `create_activity`
- `complete_task`

Agent access provides agent configuration, history, activity, files, guided
creation, revision, deployment, lifecycle management, runs, retries, and
cancellation. Agent creation uses the same builder and review flow as the app.

Agent access provides these tools:

- `research_company`
- `research_contact`
- `list_agents`
- `start_agent_run`
- `get_agent`
- `list_agent_runs`
- `list_agent_activity`
- `list_agent_files`
- `create_agent_draft`
- `get_agent_creation`
- `answer_agent_creation_question`
- `update_agent`
- `save_agent_file`
- `revise_agent`
- `deploy_agent`
- `retry_agent_run`
- `cancel_agent_run`
- `pause_agent`
- `resume_agent`
- `archive_agent`
- `restore_agent`

`delete_agent` also requires delete access.

Delete access provides activity deletion and individual or bulk record
deletion. It also permits agent deletion when the token has agent access.

Delete access provides these tools:

- `delete_activity`
- `delete_company`
- `bulk_delete_companies`
- `delete_contact`
- `bulk_delete_contacts`
- `delete_deal`
- `bulk_delete_deals`

Administrative access provides custom-field creation, updates, ordering,
archival, restoration, and backfills. The server also requires an owner or
administrator workspace role. Permanent field deletion also requires delete
access.

Administrative access provides these tools:

- `create_custom_field`
- `update_custom_field`
- `reorder_custom_fields`
- `archive_custom_field`
- `restore_custom_field`
- `backfill_custom_field`

`delete_custom_field` also requires delete access.

`create_deal` requires `product`.

`update_deal` accepts `product` and prevents clearing its required custom field.

The MCP has no import tool. Connected systems create and update records through
the normal tools. This path preserves CRM validation, events, and agent queues.

Every tool returns both response forms.

- `content[0].text` contains JSON for older clients.
- `structuredContent.result` contains the same JSON-compatible value.

The five Oximy and LinkedIn tools publish explicit output schemas.

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
