# Plan — Merge Oximy GTM into CRM

**Status:** Proposed

**Goal:** CRM owns engaged relationships. Cardinal owns outbound. GTM becomes intelligence inside CRM.

```text
Cardinal Interested
        ↓
Gmail sync or manual capture
        ↓
CRM company, contact, owner, and activity
        ↓
ClickHouse and web research
        ↓
Follow-up, meeting, deal, and durable history
```

## 1. Product boundary

| System | Responsibility |
| --- | --- |
| Cardinal | Discovery, lists, qualification, phone and email enrichment, campaigns, signals, inbox, and tasks |
| CRM | Interested relationships, ownership, activities, meetings, calls, and deals |
| GTM intelligence | People search, company resolution, role ranking, tenure, and organizational mapping |

CRM must not recreate Cardinal's campaigns, monitors, inbox, tasks, or cold prospecting experience.

The standalone GTM interface disappears after CRM exposes its useful intelligence.

## 2. CRM entry rule

A person enters CRM when a seller decides the relationship deserves continued work.

The normal signal is a Cardinal **Interested** conversation.

Other valid signals include these events.

- A meeting is booked.
- A seller captures a useful LinkedIn conversation.
- An existing relationship creates a referral or introduction.

Cold Cardinal prospects do not automatically enter CRM.

## 3. Target workflows

### Interested email

1. Cardinal sends through the seller's connected Gmail mailbox.
2. The prospect replies.
3. The seller replies from Cardinal or Gmail.
4. Gmail sync creates or matches the company and contact.
5. CRM assigns the seller as owner.
6. CRM files the thread on the relationship timeline.

Each seller must enable Gmail contact auto-creation.

Each Cardinal sender must match the connected Gmail mailbox identity.

CC and BCC are unnecessary for this path.

### Interested LinkedIn conversation

1. The seller copies the Cardinal or LinkedIn conversation.
2. The seller pastes it into CRM chat.
3. The seller invokes `Capture interested contact`.
4. The agent extracts the contact, company, channel, and campaign.
5. The agent resolves existing records and asks only for missing information.
6. The agent creates or updates the company and contact.
7. The agent assigns the current seller.
8. The agent records the conversation as LinkedIn activity.
9. Research and enrichment begin afterward.

The same action supports pasted email conversations as a fallback.

### High-touch company list

1. A seller imports selected companies into Cardinal.
2. Cardinal creates a list or campaign audience.
3. Cardinal qualifies companies and people with AI.
4. Cardinal enriches selected people with phone and email data.
5. Cardinal runs the high-touch campaign.
6. Interested people enter CRM through Gmail or manual capture.

Cold hit-list companies do not need CRM records.

## 4. Required CRM work

### A. Canonical Oximy context

Create one shared context covering Visibility, Relay, and Sidekick.

Each product definition includes these fields.

- Customer problems.
- Qualifying company signals.
- Relevant buyers and champions.
- Disqualifying signals.
- Research questions.
- Evidence requirements.
- Approved positioning language.

CRM agents and ClickHouse ranking use this context.

Cardinal receives the same context manually until its MCP arrives.

### B. Capture interested contacts

Add one general agent capability named `Capture interested contact`.

It accepts copied text, screenshots, email summaries, names, domains, and LinkedIn URLs.

It performs these actions.

- Resolve or create the company.
- Resolve or create the contact.
- Prevent duplicate records.
- Assign the current seller.
- Record source, channel, campaign, list, and interest time.
- Store the copied conversation as activity.
- Start research after capture.

This capability must not require a pre-existing company.

### C. Unified relationship timeline

Extend the existing timeline with these sources.

- Gmail and Google Calendar.
- Granola notes and summaries.
- Quo calls, messages, recordings, and transcripts.
- Manually captured LinkedIn conversations.
- Cardinal campaign and reply metadata.
- Seller notes and tasks.
- Research results and deal changes.

Every activity resolves to a company or contact.

### D. GTM intelligence tools

Expose GTM's unique capabilities through the CRM agent.

- Search people with structured filters.
- Resolve LinkedIn company entities.
- Find current employees at one company.
- Rank employees using buyer-role tiers.
- Read current and previous employment.
- Compare tenure and career movement.
- Read profile details, skills, and education.
- Perform current company and person research.

Global CRM chat supports broad people searches.

The company Agent tab supports contextual organizational mapping.

Results render as selectable tables. Selected rows can become CRM contacts.

### E. Buyer-role tiers

Preserve GTM's editable title tiers.

Rename them as buyer-role tiers.

They order people inside company searches. They do not represent company ICP fit.

Use one shared configuration across CRM and ClickHouse operations.

### F. Enrichment

Run enrichment after interest, selection, or explicit seller action.

Cardinal owns pre-outreach phone and email enrichment.

The CRM agent enriches relationship context after handoff.

It can use CRM history, ClickHouse, web research, Context, and future Cardinal data.

### G. Seller and CEO views

Do not create a separate Today page.

Cardinal Inbox and Tasks remain the daily outbound queue.

CRM remains the daily relationship and pipeline surface.

The existing Overview remains the CEO surface.

After Cardinal integration, add these aggregates.

- Interested conversations by seller.
- Unanswered Interested conversations.
- Interested-to-meeting conversion.
- Meetings and opportunities by source.
- Pipeline and wins by originating campaign.

## 5. GTM retirement phases

### Phase 0 — Operational setup

- Enable Gmail auto-creation for every seller.
- Verify every Cardinal sender against its connected Gmail identity.
- Correct Cardinal's Oximy company and ICP context.
- Confirm Google synchronization health for every seller.

**Exit:** A seller reply creates the correct CRM company, contact, owner, and activity.

### Phase 1 — Interested capture V1

- Build `Capture interested contact`.
- Support copied LinkedIn and email content.
- Add manual LinkedIn activity to the existing timeline.
- Store source, channel, campaign, list, owner, and interest time.
- Add complete Visibility, Relay, and Sidekick context.

**Exit:** Sellers capture Interested conversations without opening CRM creation forms.

### Phase 2 — GTM intelligence merge

- Expose GTM people search to the CRM agent.
- Expose company resolution and employee discovery.
- Move buyer-role tiers into shared CRM configuration.
- Render selectable results in global and company chat.
- Add organizational mapping to the company Agent tab.

**Exit:** Sellers complete every useful GTM workflow inside CRM.

### Phase 3 — Cardinal integration and GTM removal

- Inspect Cardinal's available MCP or API tools.
- Synchronize Interested state and campaign metadata.
- Validate CRM activity completeness against Cardinal samples.
- Migrate only useful shared GTM lists.
- Archive the old qualified-leads corpus.
- Remove the GTM navigation and deployment.

**Exit:** No recurring seller workflow depends on `gtm.oximy.com`.

## 6. Data captured at handoff

| Field | Purpose |
| --- | --- |
| Company and domain | Account identity and deduplication |
| Contact name | Relationship identity |
| Email | Gmail matching and enrichment |
| LinkedIn URL | LinkedIn identity and ClickHouse matching |
| Owner | Seller responsibility |
| Channel | Email, LinkedIn, call, event, or referral |
| Source | Cardinal, manual, Gmail, Granola, or Quo |
| Campaign and list | Attribution and seller context |
| Interested time | Relationship start and response measurement |
| Conversation activity | Durable follow-up context |
| Product hypothesis | Visibility, Relay, Sidekick, or unknown |

The product hypothesis remains editable.

The agent explains the evidence supporting every suggested hypothesis.

## 7. Implementation boundaries

- Deterministic Gmail and Calendar synchronization remains in the API.
- Research, ranking, enrichment, and identity decisions remain in `apps/agent`.
- ClickHouse access remains read-only.
- CRM extends existing Chat, Agent, timeline, list, and Overview surfaces.
- Every external integration remains optional.
- Missing Cardinal access does not stop core CRM workflows.

## 8. Non-goals

- Cold prospect discovery pages inside CRM.
- Campaign sequencing or email sending.
- LinkedIn automation.
- Cardinal-style monitors, inbox, or tasks.
- Cold company imports or prospecting lists.
- Phone or email enrichment before outreach.
- Automatic import of every Cardinal person.
- Automatic deal creation from every Interested reply.
- A separate chat for every CRM surface.

## 9. Definition of done

- An Interested email reply enters CRM without manual data entry.
- A seller captures an Interested LinkedIn conversation with one chat request.
- CRM preserves the owner, channel, campaign, and conversation history.
- A seller can ask who else matters at a company.
- ClickHouse returns a useful organizational map inside CRM.
- Global CRM chat searches the proprietary people dataset.
- Meetings, calls, notes, and deals share one relationship timeline.
- Cardinal remains the only outbound execution surface.
- No recurring seller workflow requires the standalone GTM application.
