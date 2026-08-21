# Prospecting and outbound landscape for Oximy

Date: 2026-08-18

## Purpose

This explanation supports a ten-person company with three GTM users.

It evaluates tools for finding a repeatable market and booking qualified meetings.

It covers sourcing, scoring, signals, enrichment, outreach, learning, and measurement.

It also separates capabilities Oximy should build from capabilities Oximy should buy.

Prices exclude taxes and negotiated discounts.

Vendor claims describe vendor-reported capabilities unless an independent source supports them.

## Executive decision

Oximy should keep CRM as the system of record and decision layer.

Oximy should buy commodity company and contact data.

Oximy should buy email verification and sending infrastructure.

Oximy should build product-specific qualification, message strategy, feedback loops, and agent workflows.

Oximy should not build a global people database.

Oximy should not automate LinkedIn through scraping or unauthorized browser actions.

The best first trial is Apollo plus Ocean.io inside CRM.

Apollo supplies people search, contact details, and a low-cost engagement baseline.

Ocean supplies company similarity, semantic search, API access, and MCP access.

The second trial should compare Unify against the Apollo workflow.

Unify now offers a three-seat Pro configuration for $180 monthly.

Its Business tier contains the strongest signal automation and deliverability features.

Oximy should test data quality before selecting any provider.

The team should use one representative sample across Relay, Sidekick, and Visibility.

The sample must include known matches, known failures, and ambiguous companies.

## What the market has converged on

Modern prospecting products combine seven layers.

1. A company and person database creates the initial market.
2. Firmographic, technographic, and semantic filters estimate account fit.
3. Intent signals estimate timing.
4. Waterfall enrichment finds verified contact channels.
5. Research agents convert evidence into outreach context.
6. Sequencers coordinate email, calls, and manual social tasks.
7. Attribution connects actions to replies, meetings, pipeline, and revenue.

No vendor solves target-market discovery by itself.

Vendors make existing hypotheses faster to test.

Weak hypotheses produce larger bad lists and faster spam.

Oximy needs an experimentation system more than a permanent ICP score.

## Capability map

| Product | Strongest layer | Other useful layers | Small-team fit | Main concern |
| --- | --- | --- | --- | --- |
| Apollo | People sourcing | Enrichment, scoring, intent, sequences, calls | Strong | Data quality needs testing |
| Clay | Data orchestration | Research, signals, personalization, sequencing | Medium | Cost and workflow complexity |
| Common Room | Signal aggregation | Identity, scoring, research, activation | Weak | $30,000 annual entry price |
| Unify | Unified outbound action | Data, signals, research, sequencing | Strong | Best signals require Business |
| Amplemarket | Multichannel execution | Data, signals, delivery, AI help | Medium | $600 monthly includes two users |
| Regie.ai | AI sales engagement | Dialing, enrichment, research, scoring | Weak | Five-seat or ten-seat minimums |
| 11x | Autonomous outbound | Data, mailboxes, booking, CRM sync | Weak | $45,000 annual entry price |
| Artisan | Managed AI BDR | Data, replies, booking, CRM | Weak | Quote pricing and managed dependence |
| Persana | Historical orchestration | Enrichment, signals, research | None | Standalone service ended |
| Ocean.io | ICP similarity | Search, contacts, API, MCP | Strong | No CRM or sequencing |
| People Data Labs | Data infrastructure | Person, company, and IP APIs | Medium | Oximy builds orchestration |
| ZoomInfo | Enterprise intelligence | Intent, org charts, enrichment, Copilot | Weak | Quote pricing and enterprise weight |
| Sales Navigator | Human social selling | Search, alerts, paths, InMail | Strong | Automation risks accounts |

## Detailed product findings

### Apollo

Apollo provides contact data, account data, enrichment, scoring, intent, and engagement in one product.

Its pricing matches a small team.

The annual Basic plan costs $49 per user monthly.

The annual Professional plan costs $79 per user monthly.

The annual Organization plan costs $119 per user monthly and requires three seats.

Professional adds unlimited lead scores and standard analytics.

Organization adds more intent topics, custom reports, security controls, and bring-your-own-model support.

Apollo also supports sequences, email testing, calls, follow-ups, and opportunity management.

Its [official pricing page](https://www.apollo.io/pricing?solution=enrichment) lists current credits and plan features.

Apollo can replace the team's manual people search and manual CRM entry.

CRM should create Apollo searches from approved company lists and personas.

CRM should import source evidence, match confidence, and verification dates.

The team should never treat one Apollo match as confirmed identity.

Email bounce rate and phone reach rate must control future provider selection.

Apollo sequences can provide the first execution baseline.

CRM should still own audience assignment, product hypothesis, and experiment identity.

Apollo supports manual LinkedIn steps inside sequences.

Apollo gives the representative a profile link and prepared context.

The representative completes the LinkedIn action manually.

The [Apollo LinkedIn task guide](https://knowledge.apollo.io/hc/en-us/articles/5646233248269-Complete-LinkedIn-Tasks-in-a-Sequence) documents this pattern.

Recommendation: trial now.

### Clay

Clay is a flexible data and workflow platform.

It connects more than 150 data partners and supports AI-sourced enrichment.

Claygent handles company research, qualification, and signal discovery.

Clay Sequencer combines current data, intent, personalized copy, and campaign attribution.

Clay now offers Free, Launch, Growth, and Enterprise plans.

Launch costs $185 monthly with 15,000 actions and 2,500 data credits.

Growth costs $495 monthly with 40,000 actions and 6,000 data credits.

Clay explains this model in its [official pricing memo](https://www.clay.com/blog/clay-pricing-memo-internal).

Clay's [enrichment page](https://www.clay.com/use-cases/data-enrichment) lists more than 200 enrichment tools and agents.

Its [Sequencer page](https://www.clay.com/sequencer) describes native campaigns and attribution.

Clay fits a dedicated GTM engineer better than three occasional operators.

It becomes valuable after Oximy proves stable qualification logic.

Using Clay now creates two workflow builders: Clay and CRM.

That duplication increases maintenance and hides learning outside CRM.

Recommendation: defer unless Apollo and Unify data fail.

### Common Room

Common Room unifies website, product, social, community, CRM, and external signals.

Person360 performs waterfall identity resolution and enrichment.

RoomieAI Capture researches accounts and custom signals.

RoomieAI Spark delivers researched prospects through Common Room, Slack, and email.

RoomieAI Activate produces signal-grounded outbound messages.

The Essential plan costs $2,500 monthly when billed annually.

It includes five seats, 100,000 contacts, research credits, prospecting credits, and selected integrations.

The [official pricing page](https://www.commonroom.io/pricing/) lists CRM, SEP, Slack, MCP, and signal features.

The [RoomieAI overview](https://www.commonroom.io/product/ai/) describes scoring, research, enrichment, and automated action.

Common Room provides a useful product blueprint.

Its price exceeds Oximy's current need.

Oximy lacks enough first-party volume to exploit its full identity graph.

Recommendation: copy the workflow principles, not the product purchase.

### Unify

Unify combines sourcing, data providers, agents, signals, sequencing, and task management.

Its Free tier supports three seats.

Its Base tier costs $20 per seat monthly.

Its Pro tier costs $60 per seat monthly.

Pro includes 2,400 credits per seat, read-only CRM sync, Slack alerts, and analytics.

Business adds website intent, product signals, triggered plays, managed mailboxes, and read-write CRM sync.

Business uses custom annual pricing.

The [official pricing page](https://www.unifygtm.com/pricing) documents these limits.

Unify states that it connects more than 40 data sources.

Its database claims 1.1 billion people and 65 million companies.

Agents perform account qualification, person scoring, research, and personalization.

The [agent documentation](https://docs.unifygtm.com/reference/agents/overview) describes custom questions inside Plays and Sequences.

The [signals product](https://www.unifygtm.com/products/signals) combines first-party, third-party, and AI-discovered evidence.

Unify best matches the desired single-surface future.

It also threatens CRM's role if workflows live only inside Unify.

Oximy should test Unify as an execution and data provider.

CRM must retain campaign definitions, scores, evidence, outcomes, and suppression rules.

Recommendation: run a controlled Pro trial, then request one Business quote.

### Amplemarket

Amplemarket combines a people database, signals, enrichment, multichannel sequences, dialing, and deliverability controls.

Its Startup plan costs $600 monthly on an annual commitment.

That plan includes two users.

It includes 200 million contacts, intent signals, Duo agents, multichannel outreach, and deliverability tools.

Growth and Elite use tailored pricing.

Its [official pricing explanation](https://www.amplemarket.com/blog/amplemarket-pricing) lists current plans and included layers.

Its [platform pricing page](https://www.amplemarket.com/pricing) lists domain health, warming, spam checks, and mailbox recommendations.

Duo agents produce signal-based lists and personalized multichannel sequences.

Mailbox rotation spreads volume and protects sending infrastructure.

Amplemarket provides stronger execution controls than Apollo.

It offers less flexible data orchestration than Clay.

Its price remains plausible after Oximy proves outbound volume.

Recommendation: shortlist for the second phase.

### Regie.ai

RegieOne joins human tasks and AI agents in one sales engagement workflow.

It covers sourcing, enrichment, research, scoring, email, social tasks, calling, and attribution.

The AI SEP costs $180 per user monthly with a ten-seat minimum.

The Force Multiplier costs $499 per user monthly with a five-seat minimum.

The higher plan includes ten mailboxes, warming, enrichment, research, and parallel dialing.

Regie reports more than 100 built-in signals and 220 million contacts.

The [official pricing page](https://www.regie.ai/pricing) documents plans, minimums, credits, and add-ons.

Regie has the right human-agent operating model.

Its minimum contract size does not match three GTM users.

Recommendation: do not buy now.

### 11x

11x sells autonomous digital workers.

Alice runs prospecting, personalized outreach, CRM synchronization, and meeting booking.

The Growth plan starts at $3,750 monthly with annual billing.

It supports five users and 2,000 new prospects monthly.

It includes managed Gmail mailboxes, domains, warming, rotation, monitoring, and CRM synchronization.

The [official Alice pricing page](https://www.11x.ai/products/alice/pricing) lists these terms.

11x reduces operational work but outsources important market learning.

Oximy currently needs explicit human judgment and fast hypothesis changes.

Recommendation: do not buy during market discovery.

### Artisan

Artisan sells Ava as an autonomous AI BDR.

Every plan includes 250 million contacts, autonomous replies, booking, CRM sync, and onboarding.

Team targets about 2,500 contacted leads monthly.

Scale targets about 6,000 contacted leads monthly.

Pricing depends on the configured plan.

The [official pricing page](https://www.artisan.co/pricing) documents volumes and included features.

Artisan supplies a managed motion rather than a composable data service.

That approach reduces transparency during ICP discovery.

Recommendation: do not buy now.

### Persana

Persana previously offered waterfall enrichment, signals, research agents, sequencing, and workflow automation.

The company joined Rox in March 2026.

Persana suspended billing on April 1, 2026.

The standalone platform ended on May 2, 2026.

Persana then deleted remaining platform data.

The [official migration guide](https://persana.ai/blogs/persana-ai-migration-guide) confirms the dates and migration path.

The [official announcement](https://persana.ai/blogs/exciting-news-our-next-chapter) explains the Rox combination.

Recommendation: exclude Persana and evaluate Rox separately later.

### Ocean.io

Ocean specializes in company and person similarity.

Users provide one or more known companies.

Ocean returns similar companies ranked through contextual vector similarity.

It supports natural-language search, firmographics, technologies, growth signals, and contacts.

Ocean reports 67 million companies and more than 250 million people.

The platform supports API, MCP, webhooks, Clay, HubSpot, Pipedrive, and a Chrome extension.

The annual subscription starts at $32 monthly for 9,000 yearly credits.

Search results cost 0.2 credits each.

Verified emails cost one credit each.

Direct phone numbers cost ten credits each.

The [official pricing page](https://www.ocean.io/pricing) documents current credits and integrations.

The [official API page](https://www.ocean.io/api) documents search, enrichment, lookalikes, and email reveal.

Ocean directly replaces the gut-feeling spreadsheet expansion process.

It can seed from agreed positive companies and generate adjacent experiments.

CRM should store every seed, similarity score, model version, and later outcome.

Recommendation: trial now through MCP and API.

### People Data Labs

People Data Labs provides person, company, search, identity, and IP APIs.

It charges only for successful matches.

Person enrichment starts at $98 monthly for 350 records.

Company enrichment starts at $100 monthly for 1,000 records.

The free tier supplies 100 monthly person records and 100 monthly company records.

The [official pricing documentation](https://support.peopledatalabs.com/hc/en-us/articles/25794271805211-Pricing-credits) lists per-record volume tiers.

The [person API reference](https://docs.peopledatalabs.com/docs/reference-person-enrichment-api) supports matching from existing identity evidence.

People Data Labs is an infrastructure component.

It does not supply sequencing, campaign management, or learning workflows.

It fits Oximy only after CRM owns a mature enrichment abstraction.

Recommendation: use as a benchmark provider, not the first interface.

### ZoomInfo

ZoomInfo combines deep account data, contacts, organizational structures, intent, enrichment, and AI prioritization.

ZoomInfo Copilot recommends whom to contact, when to engage, and what to say.

Its official website requires a quote.

The [official pricing FAQ](https://www.zoominfo.com/faqs/pricing) explains package-based pricing without public figures.

The [official Copilot announcement](https://pipeline.zoominfo.com/sales/announcing-zoominfo-copilot) describes AI-guided recommendations.

Independent 2026 estimates place entry contracts near $15,000 annually.

Those estimates require vendor confirmation.

ZoomInfo offers more depth than a three-person exploratory motion needs.

Its annual contract also reduces experimentation flexibility.

Recommendation: do not buy before proven market pull.

### LinkedIn Sales Navigator

Sales Navigator remains valuable for professional context and relationship paths.

Representatives can use advanced search, lead alerts, TeamLink, InMail, and saved accounts.

Advanced Plus supports CRM synchronization with approved partners.

Supported partners include Salesforce, HubSpot, Microsoft Dynamics 365, and Oracle Sales.

CRM Sync supports matching, auto-save, activity writeback, reporting, and selected record creation.

It does not generally write LinkedIn company data into arbitrary CRMs.

The [CRM integration guide](https://www.linkedin.com/help/sales-navigator/answer/a8037044) documents Advanced Plus requirements.

The [technical limitations](https://www.linkedin.com/help/sales-navigator/answer/a8637051) explain writeback and record-matching boundaries.

LinkedIn prohibits unauthorized software that scrapes data or automates member actions.

The [violating tools policy](https://www.linkedin.com/help/sales-navigator/answer/a1339701) states this restriction.

Oximy should use LinkedIn as a human review and relationship surface.

CRM can prepare tasks, context, draft messages, and profile links.

The representative should complete profile views, connections, and messages manually.

Recommendation: keep human-in-the-loop LinkedIn workflows.

## Feature analysis by pipeline stage

### Sourcing

Apollo provides the simplest replacement for current Apollo browser work.

Ocean provides the best direct replacement for manual company guessing.

Clay provides the widest composable sourcing layer.

Unify provides the strongest single-surface combination for three users.

CRM should accept a plain-language market hypothesis.

The agent should convert it into transparent filters and evidence questions.

Every generated company needs a source, seed, query, and creation reason.

### ICP scoring

Oximy should not use one permanent score.

It should store separate product scores for Relay, Sidekick, and Visibility.

Each score needs fit, evidence, timing, confidence, and disqualifier components.

The system should preserve the underlying facts behind each component.

Users need editable weighting and score explanations.

Ocean similarity can create candidates.

CRM should own final scoring and later calibration.

### Intent signals

Common Room and Unify provide the strongest broad signal orchestration.

Apollo supplies a cheaper, narrower intent starting point.

Regie and Amplemarket combine signals with immediate action.

Oximy should begin with observable signals it can validate.

Examples include funding, leadership changes, AI hiring, security hiring, and relevant product launches.

First-party signals include pricing visits, demo activity, content engagement, and prior conversations.

Signals should change priority and suggested action.

Signals should never override poor account fit.

### Contact selection and enrichment

The current title list is too broad.

The agent should construct a buying committee for each product hypothesis.

It should identify an economic buyer, technical evaluator, operator, champion, and likely blocker.

Seniority alone cannot determine the best contact.

The system should explain why each person fits one buying role.

Apollo should supply the first enrichment waterfall.

Ocean and People Data Labs should provide benchmark samples.

CRM should record provider, match confidence, verification date, and contact consent state.

### Deliverability

Deliverability is infrastructure, not message quality.

Oximy should buy domain monitoring, warming, mailbox rotation, verification, bounce handling, and suppression enforcement.

Amplemarket, Regie, 11x, and Unify Business bundle these functions.

Apollo provides a lower-cost sending baseline.

CRM should own global opt-outs and contact suppression.

One provider failure must never allow another provider to contact a suppressed person.

### Personalization

The current job-tenure judgment is valuable but incomplete.

CRM should convert it into explicit evidence and a pitch strategy.

Long tenure can support a company-impact message.

Recent movement can support a role-success or career-impact message.

Frequent movement can reduce relationship investment or change the call-to-action.

These rules need testing against replies and meetings.

Agents should cite public evidence and avoid invented motivations.

Users should approve first touches for high-value prospects.

### Multichannel outreach

Email, calls, and manual LinkedIn tasks should share one cadence.

The cadence should branch on signal strength, seniority, relationship, and engagement.

AI should draft messages and recommend actions.

Humans should control sensitive LinkedIn and executive outreach.

Apollo can provide the first sequencing engine.

Amplemarket or Unify can replace it after measured limitations appear.

### Learning loops

This is the most important capability for Oximy to build.

Every prospect must retain its hypothesis and decision history.

Every outbound action needs product, persona, message angle, channel, and evidence identifiers.

Every response needs a structured outcome.

Useful outcomes include interested, wrong person, wrong timing, wrong problem, no priority, and unsubscribe.

Meetings need qualification results, not only booking status.

The system should update hypotheses through aggregated evidence.

It should not silently rewrite historical scores.

### Measurement

Qualified meetings per targeted account is the primary experiment metric.

Bookings alone reward low-quality volume.

The dashboard should include these measures:

- Accounts researched per hour.
- Contacts accepted per researched account.
- Enrichment match rate by provider.
- Verified email rate by provider.
- Bounce rate by provider and mailbox.
- Positive reply rate by product hypothesis.
- Qualified meeting rate by product hypothesis.
- Qualified meeting rate by persona and message angle.
- Time from signal to first human action.
- Opportunity creation and progression.
- Suppression, complaint, and unsubscribe rates.

## Build versus buy

### Build inside CRM

- A unified company, person, relationship, signal, and activity history.
- Separate Relay, Sidekick, and Visibility hypotheses.
- Evidence-backed scoring with editable versions.
- A buying-committee model with explicit roles.
- Agent skills for research, qualification, contact selection, and message strategy.
- Provider-independent enrichment requests and result provenance.
- Experiment definitions and audience assignment.
- A review queue for high-value or low-confidence work.
- Global suppression and outreach policy enforcement.
- Outcome classification and score calibration.
- Qualified-meeting attribution and cohort reports.
- MCP tools for approved reads and actions.

### Buy or integrate

- Global company and person datasets.
- Email and phone lookup.
- Email verification.
- Company similarity models.
- Website visitor identification.
- Email sending, mailbox rotation, and warming.
- Calling infrastructure.
- Approved LinkedIn products.
- Specialized intent feeds.

### Avoid now

- A second permanent CRM.
- A fully autonomous AI SDR contract.
- A global contact database built internally.
- Unauthorized LinkedIn scraping or messaging automation.
- One opaque ICP score across all products.
- High-volume outreach before qualification works.

## Recommended stack tests

### Test A: lowest-friction baseline

Use CRM, Apollo Professional, Ocean.io, and Sales Navigator.

CRM controls hypotheses, evidence, experiments, review, suppression, and outcomes.

Apollo supplies people data, enrichment, and sequences.

Ocean supplies company expansion and similarity.

Sales Navigator supports manual validation and relationship action.

Estimated public software cost starts near $269 monthly for three Apollo seats and Ocean.

Sales Navigator costs need current seat confirmation.

### Test B: consolidated challenger

Use CRM, Unify Pro, Ocean.io, and Sales Navigator.

Public Unify Pro pricing totals $180 monthly for three seats.

Ocean starts at $32 monthly with annual billing.

This test compares a unified chat workflow against Apollo's established database.

Business-only signals and managed mailboxes need a separate quote.

### Test C: execution challenger

Use CRM, Apollo or Ocean data, and Amplemarket.

Run this test only after email volume justifies dedicated deliverability controls.

The public Startup price is $600 monthly for two users.

Oximy must confirm the third-user price before testing.

## Thirty-day vendor evaluation

### Week 1: create the benchmark

Choose 150 companies across three product hypotheses.

Include 30 known good accounts and 30 known bad accounts.

Include 90 uncertain accounts from the existing sheet.

Define target buying roles for every product.

Freeze the expected results before testing vendors.

### Week 2: test sourcing and enrichment

Run identical inputs through Apollo, Ocean, and Unify.

Use People Data Labs on a smaller benchmark sample.

Measure company match, role relevance, verified email, phone reach, duplicates, and stale employment.

Record cost per accepted contact.

### Week 3: test workflows

Create three small outreach experiments.

Use one product hypothesis per experiment.

Keep daily volume low.

Require human approval for first messages.

Measure research time, editing time, bounce rate, replies, and qualification.

### Week 4: choose the boundary

Select the smallest vendor set that passes the benchmark.

Keep provider adapters replaceable.

Store all learning in CRM.

Reject any vendor that cannot return usable provenance or exportable outcomes.

## Procurement scorecard

| Criterion | Weight | Required evidence |
| --- | ---: | --- |
| Qualified meeting improvement | 25% | Controlled cohort results |
| Company and person accuracy | 20% | Frozen benchmark results |
| Workflow time reduction | 15% | Timed representative tasks |
| CRM and API control | 15% | Live integration test |
| Deliverability protection | 10% | Domain and mailbox reports |
| Explainability and provenance | 5% | Stored source evidence |
| Export and portability | 5% | Full data export test |
| Price and contract flexibility | 5% | Written quote and terms |

## Final recommendation

Start with a narrow Apollo and Ocean pilot.

Run Unify Pro against the same benchmark.

Use CRM as the control plane for both tests.

Build the experimentation and learning layer before building more data connectors.

Add Cardinal through MCP when its interface becomes available.

Treat Cardinal as another evidence and action provider.

Do not make Cardinal a second source of truth.

Keep LinkedIn actions manual and policy-compliant.

Delay autonomous outbound products until Oximy proves one repeatable market motion.

The winning system makes each market hypothesis cheap to test and easy to explain.

It does not maximize the number of messages sent.

## Research method and limits

This review used Parallel Search and standard web search on August 18, 2026.

Primary product pages, documentation, pricing pages, and announcements received priority.

Independent reviews informed concerns about cost, complexity, and data quality.

Vendor outcome claims are not independent benchmarks.

Oximy still needs live trials against its own target accounts.

Public prices can change after this review date.

Quote-based products require written commercial confirmation.

## Issues

1. UNKNOWN — Vendor data accuracy for Oximy's target accounts is not tested.
   Fix: run the frozen benchmark before purchase.
2. UNKNOWN — Sales Navigator seat pricing is not confirmed for Oximy's contract.
   Fix: request the current three-seat quote.
3. RISK — Unauthorized LinkedIn automation can restrict representative accounts.
   Fix: keep profile views, connections, and messages manual.
4. RISK — Vendor-native workflows can hide learning outside CRM.
   Fix: store hypotheses, evidence, actions, and outcomes in CRM.
5. RISK — Autonomous outbound can scale a weak market hypothesis.
   Fix: require qualification evidence and controlled volume.
6. BROKEN — Persana standalone service ended on May 2, 2026.
   Fix: exclude Persana and evaluate Rox separately.
7. BROKEN — The Median CLI is unavailable in this repository.
   Fix: install or expose `mdn` before task status checks.
