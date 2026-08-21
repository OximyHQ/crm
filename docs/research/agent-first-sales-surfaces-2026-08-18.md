# Agent-first sales surfaces for Oximy

## Purpose

This document evaluates where Oximy sellers should interact with CRM data and sales agents.

It covers the CRM application, Slack, ChatGPT, Claude, MCP, Cardinal, and LinkedIn constraints.

The audience is Oximy's product, engineering, and GTM team.

The goal is lower seller effort and more qualified meetings.

This report explains architecture choices.

It does not define the complete prospect scoring model.

## Research boundary

The repository review reflects code available on 2026-08-18.

The external research reflects public material available on 2026-08-18.

The current Cardinal account was not inspected.

Cardinal's future MCP is a user-provided plan.

Public Cardinal material confirms product direction, not Oximy's purchased features.

Production connector health was not inspected.

## Recommendation

Keep `crm.oximy.com` as the system of record and control plane.

Do not require sellers to use it as the only daily interface.

Use a hybrid surface model.

- Slack becomes the daily work queue and approval inbox.
- The CRM remains the review, correction, configuration, and audit surface.
- ChatGPT and Claude become optional reasoning surfaces through CRM MCP.
- The CRM agent remains the durable execution runtime.
- Cardinal becomes one provider behind the agent after its MCP arrives.
- LinkedIn remains a human-reviewed research and engagement surface.

This approach removes most tab switching without weakening data control.

It also avoids dependence on one conversational client.

## Why one interface is the wrong target

Sales work has four different interaction modes.

| Mode | Best surface | Reason |
| --- | --- | --- |
| Fast triage | Slack | Sellers already watch messages and notifications. |
| Deep reasoning | ChatGPT, Claude, or CRM agent | Conversation supports questions, synthesis, and iteration. |
| Structured review | CRM | Tables expose comparisons, missing data, and batch choices. |
| Governance | CRM | Settings, permissions, history, and audit require stable controls. |

One surface performs poorly across all four modes.

A chat transcript hides list state and unresolved conflicts.

A record sheet adds friction to quick approvals.

A Slack thread becomes difficult during broad list review.

The architecture needs one truth source and several controlled views.

## Current Oximy foundations

Oximy already has much of the required platform.

### CRM MCP

The CRM serves remote MCP at `https://crm.oximy.com/api/mcp`.

It uses Better Auth as its OAuth 2.1 authorization server.

Its scopes separate read, write, agent, delete, and administrator access.

The MCP exposes record, activity, task, dashboard, communication, and agent tools.

The tools reuse existing CRM services.

Intelligent MCP tools enqueue agent work.

This design keeps validation and durable execution inside CRM.

### Agent runtime

`apps/agent` owns research, enrichment, matching, scoring logic, and agent decisions.

Durable `AgentTask` rows separate requests from execution.

The worker uses leases and retry-aware execution.

Custom agent versions have explicit triggers, record scope, connections, and actions.

Deployment is the human approval boundary.

Sensitive tool calls also support runtime approval.

### Skills

The main agent already has five focused skills.

- Data boundaries control what information can leave Oximy.
- Evidence rules control fact quality.
- Identity matching controls person matching.
- Prospecting controls contact discovery.
- Brief writing controls output structure.

Oximy does not need a new skill mechanism.

It needs sales-specific skills using the existing mechanism.

### Slack

The CRM already connects Slack identities and channels.

Custom agents can deliver to one approved Slack destination.

Current Slack support focuses on delivery and agent destinations.

The next step is an interactive work queue with durable CRM state.

## What Cardinal demonstrates

Cardinal describes one connected revenue-agent platform.

Its public workflow includes list definition, agent deployment, measurement, and iteration.

Its agents cover outreach, follow-up, research, scheduling, and CRM synchronization.

Its public examples also combine inbound signals, qualification, and outbound actions.

These examples include website visitors, product signups, email engagement, and job changes.

Cardinal also promotes Slack delivery and coordinated email, LinkedIn, and Twitter outreach.

Sources: [Cardinal product](https://www.trycardinal.com/), [Cardinal product details](https://trycardinal.ai/product), and [YC profile](https://www.ycombinator.com/companies/trycardinal-ai).

The useful lesson is workflow composition.

The weak lesson is replacing CRM with another large application.

Oximy should treat Cardinal as a provider and experiment engine.

Oximy should not create a second system of record around Cardinal outputs.

Every imported result needs source, observation time, provider identity, and evidence.

Every Cardinal workflow should finish through a CRM-owned operation.

Examples include creating candidates, proposing scores, or drafting outreach.

## What other systems demonstrate

### Attio

Attio explicitly supports both internal AI and external MCP clients.

Its MCP can search, create, and update records, notes, tasks, and list entries.

Attio calls its internal assistant and external MCP complementary.

This pattern directly supports Oximy's hybrid direction.

Source: [Attio MCP documentation](https://attio.com/help/reference/attio-ai/attio-mcp).

### HubSpot

HubSpot exposes read and write CRM operations through remote MCP.

Supported objects include contacts, companies, deals, calls, emails, meetings, notes, and tasks.

The server uses OAuth and existing user permissions.

HubSpot blocks sensitive activity data through MCP when sensitive-data controls are active.

Source: [HubSpot MCP documentation](https://developers.hubspot.com/docs/apps/developer-platform/build-apps/integrate-with-the-remote-hubspot-mcp-server).

### Slack and Salesforce

Slack presents CRM as a conversational engine inside daily work.

Its sales example updates pipeline state after meetings through an agent.

The same surface supports team collaboration and customer context.

Slack quotes Vercel's goal of removing direct seller data entry.

Source: [Slack conversational CRM](https://slack.com/blog/news/conversational-crm-slack-salesforce).

The lesson is not that Slack replaces all CRM screens.

The lesson is that Slack removes routine navigation and data entry.

## ChatGPT and Claude as CRM clients

The existing CRM MCP can support both external clients.

### ChatGPT and OpenAI agents

OpenAI supports remote MCP servers and service connectors.

MCP calls can require explicit approval.

The platform exposes tool inputs and outputs as structured call records.

OpenAI recommends approvals for sensitive actions and logging for shared data.

OpenAI also supports reusable, versioned skill bundles.

Sources: [OpenAI MCP documentation](https://developers.openai.com/api/docs/guides/tools-connectors-mcp) and [OpenAI skills documentation](https://developers.openai.com/api/docs/guides/tools-skills).

### Claude

Claude supports remote MCP servers across its web, desktop, mobile, and code surfaces.

Its connectors can expose tools, resources, prompts, and interactive MCP applications.

Claude also supports plugins combining MCP, skills, commands, and agents.

Source: [Claude connectors documentation](https://claude.com/docs/connectors/overview).

### Implication for Oximy

Oximy should publish one stable CRM MCP contract.

It should avoid client-specific business logic.

The CRM must enforce permissions, validation, idempotency, and audit at the tool boundary.

External clients should remain replaceable.

They can reason across CRM, email, calendars, documents, and external research.

They should not own scheduled work or unreconciled mutations.

## Architecture options

### Option A: CRM-first

The CRM application contains every agent conversation and workflow.

Sellers use Slack only for notifications.

External AI clients have no CRM access.

Benefits:

- Oximy controls the complete user experience.
- Permissions and audits stay simple.
- Structured list work stays visible.

Costs:

- Sellers continue switching into CRM for small actions.
- Oximy must build every conversational feature.
- General reasoning remains weaker than preferred external clients.

This option fits regulated environments.

It does not fit Oximy's three-person sales team.

### Option B: External-agent-first

ChatGPT or Claude becomes the primary interaction surface.

The CRM becomes a browse-only record store.

Benefits:

- Sellers use a familiar reasoning interface.
- Cross-tool synthesis becomes easy.
- Oximy builds fewer chat components.

Costs:

- Client behavior and availability can change.
- List review and bulk correction become awkward.
- Client transcripts do not provide durable workflow state.
- Approval and audit behavior differs across clients.
- External clients can expose more context than intended.

This option creates a fragile control plane.

Do not select it.

### Option C: Slack-first

Slack becomes the main seller interface.

Agents push ranked work and accept commands inside threads.

Benefits:

- The team already lives in Slack.
- Notifications and approvals become immediate.
- Team context remains visible.

Costs:

- Large list review performs poorly.
- Threads fragment related account decisions.
- Rich configuration becomes difficult.
- Sensitive data can reach broad channels.

Slack works best as an inbox, not the complete CRM.

### Option D: Hybrid control plane

The CRM owns records, workflows, permissions, evidence, and audits.

Slack owns proactive work delivery and compact approvals.

ChatGPT and Claude provide optional ad-hoc reasoning through MCP.

The in-CRM agent supports record-local questions and controlled agent building.

Benefits:

- Sellers choose the best surface for each task.
- Durable work survives chat and Slack sessions.
- The CRM keeps one authoritative history.
- External clients remain interchangeable.
- Structured review remains available.

Costs:

- Oximy must keep surface behavior consistent.
- Deep links and status synchronization require careful design.
- Permissions require one shared policy model.

Select this option.

## Recommended interaction model

### Slack as the daily inbox

Post one personal morning brief for each seller.

Include the highest-value actions, not a complete CRM digest.

Each item needs five fields.

1. The account and person.
2. The observed signal.
3. The product-fit hypothesis.
4. The recommended action.
5. The evidence and score explanation.

Offer compact actions.

- Approve contact creation.
- Request deeper research.
- Assign ownership.
- Draft outreach.
- Mark irrelevant.
- Snooze until a date.
- Open the CRM review screen.

Every action must update a durable CRM work item.

Slack message state must never become the only state.

Use direct messages for personal prospect details.

Use channels for aggregate learning and approved team workflows.

### CRM as the review and control surface

Use the CRM for work requiring comparison or correction.

Examples include candidate lists, score calibration, duplicates, and evidence conflicts.

Add a unified sales workbench.

The workbench should show these queues.

- New account candidates.
- Missing decision-makers.
- Enrichment conflicts.
- ICP score changes.
- Outreach drafts.
- Follow-up tasks.
- Stale opportunities.
- Agent failures.

Every row needs a reason and evidence link.

Every score needs visible components.

Users must separate observations from model inferences.

### External agents for ad-hoc reasoning

Support questions such as these examples.

- Which prospects resemble our successful Relay customers?
- Prepare me for tomorrow's calls.
- Find stalled deals with a new buying signal.
- Compare our Sidekick and Visibility hypotheses.
- Create a review list for these conference speakers.

Return structured result references and CRM deep links.

Long work should return a run identifier immediately.

The client can later inspect the run.

The CRM worker should execute the actual job.

### In-CRM agent for record-local work

Keep the agent panel on company, contact, and deal records.

It has useful context and stable record identifiers.

Use it for correction, research review, and action explanations.

Do not make sellers start every workflow from this panel.

## LinkedIn operating boundary

Do not build browser automation that scrapes LinkedIn profiles.

Do not automate connection requests, messages, or engagement through browser extensions.

LinkedIn prohibits scraping, browser automation, and unauthorized automated messaging.

LinkedIn can restrict accounts using prohibited tools.

Sources: [LinkedIn User Agreement](https://www.linkedin.com/legal/user-agreement) and [LinkedIn prohibited software guidance](https://www.linkedin.com/help/linkedin/answer/a1341387/prohibited-software-and-extensions).

LinkedIn's official profile APIs also have restricted access.

They do not provide general prospect profile access to every developer.

Source: [LinkedIn API access documentation](https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access).

Use four compliant patterns.

1. Store a LinkedIn URL supplied by a seller or licensed provider.
2. Open that URL for human review.
3. Apply a visible review rubric to human-observed information.
4. Use sanctioned provider data under its applicable contract.

Do not describe provider data as directly verified LinkedIn data.

Record the provider and observation time.

The agent can change its pitch recommendation after human observations.

The seller should confirm those observations before CRM storage.

## Human approval policy

Apply approval by effect, not by interface.

| Operation | Default policy |
| --- | --- |
| Read CRM data | Automatic within user scope |
| Start research | Automatic within budget |
| Add prospect candidate | Automatic in staging |
| Create authoritative contact | Human approval |
| Change human-entered identity data | Human approval |
| Draft outreach | Automatic |
| Send one approved message | Human approval |
| Start a sequence | Human approval for exact audience and template |
| Delete or merge records | Human approval |
| Change scoring rules | Administrator approval |

A prospect staging area reduces unnecessary approvals.

Candidates can remain cheap, incomplete, and reversible.

Promotion into core CRM records becomes an explicit decision.

Approvals must display audience, destination, sender, content, and expected effect.

Bulk approval must show the complete denominator.

## Data quality contract

Every important prospect fact needs provenance.

Store these fields with each observation.

- Provider.
- Source type.
- Source reference.
- Observation time.
- Retrieval run.
- Exact observed value.
- Derived normalized value.
- Evidence strength.
- Current disposition.

Do not store one unexplained confidence number.

Store score components and their evidence.

Separate company fit, person fit, timing, reachability, and relationship strength.

Keep product-fit scores separate for Relay, Sidekick, and Visibility.

One company can fit several products for different reasons.

Preserve rejected suggestions.

They prevent repeated low-quality enrichment.

## Workflow durability

External conversation sessions are not job queues.

Every long or multi-step operation needs a durable CRM record.

The record needs status, owner, timestamps, attempts, budget, and result references.

Use idempotency keys for every user-triggered write.

Record each external tool call with redacted inputs and outputs.

Record the acting user and external account.

Retry only safe or idempotent operations automatically.

Never retry message sending without a provider receipt check.

Slack and MCP clients should inspect the same work record.

## Skills to add

Extend the existing skill system.

### `icp-hypothesis`

Compare a company against explicit product hypotheses.

Return evidence for Relay, Sidekick, and Visibility separately.

### `buyer-mapping`

Find relevant roles and explain each role's likely problem.

Use the configured management levels and title families.

### `career-pattern-review`

Interpret seller-confirmed career history.

Separate company-value and personal-value messaging.

Never infer negative character traits from job changes.

### `outreach-brief`

Create one evidence-backed reason for outreach.

Produce several messages for the selected channel.

### `meeting-preparation`

Combine CRM history, recent signals, communications, and open questions.

### `pipeline-hygiene`

Find stale records, missing next steps, and unresolved ownership.

### `experiment-analysis`

Compare cohorts, messages, replies, qualified meetings, and opportunity creation.

Recommend a bounded next experiment.

Each skill needs versioning and an evaluation set.

Skills should guide agents, not bypass policy.

## Cardinal integration design

Add Cardinal through an optional capability adapter.

Do not let the root agent depend on Cardinal availability.

When Cardinal MCP arrives, inspect its tools before integration.

Classify every tool as read, staged write, authoritative write, or external action.

Allowlist only required tools.

Require approval for external messages and sequence enrollment.

Map Cardinal outputs into CRM observations and candidate lists.

Do not copy opaque Cardinal scores into authoritative CRM scores.

Retain Cardinal workflow identifiers and result references.

The agent should explain degraded behavior when Cardinal is unavailable.

## GTM application retirement

Do not copy every `gtm.oximy.com` screen into CRM.

Move capabilities in workflow order.

### Phase 1: Candidate staging

Add prospect lists, product-fit scores, evidence, and review state to CRM.

Keep GTM search as the discovery backend.

### Phase 2: Unified agent tools

Expose prospect search and candidate promotion through CRM agent tools.

Keep intelligent decisions in `apps/agent`.

### Phase 3: Unified review

Add scored-list review and batch decisions to the CRM workbench.

Stop asking sellers to create records manually.

### Phase 4: Replace GTM UI

Retire the GTM interface after feature and data parity.

Keep any valuable dataset service behind the CRM agent.

### Phase 5: Remove duplicate storage

Move list ownership, scores, and run history into the CRM system of record.

Archive old identifiers and preserve migration provenance.

## First implementation slice

Build one narrow workflow before broad automation.

Use this workflow.

1. A seller submits a company domain or short company list.
2. The agent creates staged company candidates.
3. The agent researches product fit with visible evidence.
4. The agent proposes relevant people from licensed providers.
5. The seller reviews one combined list.
6. The seller approves authoritative CRM creation.
7. The agent drafts one personalized message per person.
8. The seller approves each send or exact sequence batch.
9. The CRM measures replies, qualified meetings, and opportunities.

This slice removes the largest current manual loop.

It also creates the measurement foundation for later agents.

## Success measures

Measure outcomes and effort together.

Primary measures:

- Qualified meetings per 100 approved prospects.
- Opportunities per 100 approved prospects.
- Median seller minutes per approved prospect.
- Median time from signal to first approved action.

Quality measures:

- Enrichment acceptance rate by provider.
- Duplicate creation rate.
- Wrong-person correction rate.
- Score explanation acceptance rate.
- Outreach draft edit distance.
- Unsubscribe and negative reply rate.

Operational measures:

- Agent completion rate.
- Approval wait time.
- External connector error rate.
- Tool-call retry rate.
- Unreconciled external actions.

Compare every experiment against a fixed cohort.

Do not optimize reply rate without qualified-meeting quality.

## Decision summary

The CRM should remain authoritative.

It should not remain the only interaction surface.

Slack should deliver proactive work and approvals.

ChatGPT and Claude should access CRM through scoped MCP.

The in-CRM agent should support record review and agent configuration.

The server-side CRM agent should own durable execution.

Cardinal should enter as an optional provider.

LinkedIn actions should remain human-led unless LinkedIn explicitly authorizes automation.

This hybrid model provides convenience without losing audit, quality, or control.

## Issues

1. UNKNOWN — The current Cardinal account capabilities were not inspected.
   Fix: review its enabled workflows, exports, permissions, and future MCP tools.
2. RISK — LinkedIn browser automation violates LinkedIn rules. Seller accounts can be restricted.
   Fix: keep LinkedIn browsing and messaging human-led.
3. NOT DONE — CRM lacks a unified prospect staging and scored-list review workflow.
   Fix: build the first implementation slice before retiring GTM.
4. NOT DONE — Slack does not provide a durable interactive sales work queue.
   Fix: add CRM-backed actions and status synchronization.
5. UNKNOWN — External ChatGPT and Claude connectivity was not tested against production CRM MCP.
   Fix: run OAuth, scope, approval, and audit tests with both clients.
