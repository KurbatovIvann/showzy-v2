# Experience Foundation — Research Brief

> Status: Approved by the owner on 2026-08-17
>  
> Linear: SHO-5 · Stage: RESEARCH · Owner: human product owner

## Purpose

Build an evidence base for the information architecture, journey maps, design
system, and representative prototypes of Showzy V2 before product UI work
begins.

The research focuses on Ukrainian micro-business owners who operate primarily
from a phone and on the people who discover, buy from, and communicate with
those businesses. It must explain both how users complete work in a classic
mobile interface and where an AI-chat path is useful, trustworthy, or
inappropriate.

This brief authorizes two parallel tasks after owner approval:

- SHO-6: Ukrainian-market and competitor audit.
- SHO-7: personas and jobs-to-be-done, grounded in real-user interviews.

## Product constraints treated as fixed

Research may test how to express these decisions, but does not reopen them:

- Showzy is a business operating platform with authenticated consumer
  discovery, not a social marketplace.
- The V2 launch is mobile-first and includes the staff panel, consumer
  discovery, customer cabinet, chat, orders, documents, and AI assistant in
  one Expo app.
- Full web product flows are post-launch. Launch links open the installed app
  or a small install landing page.
- Orders require an account.
- The canonical commerce journey ends in chat with an order card, while the
  order domain remains the source of truth.
- Classic UI and AI chat invoke the same business actions. High-risk and
  irreversible operations require visible human confirmation.
- Three entry paths coexist: authenticated discovery, invite, and direct
  company/product link.

## Research goals

1. Understand the highest-frequency jobs, pain points, vocabulary, and
   decision points of Ukrainian micro-business owners and their customers.
2. Identify mobile interaction patterns that users already understand from
   Instagram, Telegram, Monobank, Nova Poshta, Poster, Checkbox, and Horoshop.
3. Determine which work users prefer to perform through classic screens,
   through AI chat, or through an explicit handoff between the two.
4. Understand trust boundaries for AI suggestions, data entry, business
   changes, payments, documents, and QES-related actions.
5. Map how a person moves from consumer discovery, invite, or direct link into
   a company-scoped customer relationship without confusing those contexts.
6. Capture Ukrainian mobile realities: device constraints, intermittent
   connectivity, notification dependence, one-handed use, and language or
   terminology expectations.
7. Produce evidence that directly constrains DEFINE, SYSTEM, PROTOTYPE, and
   later usability-validation work.

## Coverage model

The primary interview and synthesis matrix has four quadrants:

- Staff/owner using classic UI.
- Staff/owner using AI chat.
- Customer using classic UI.
- Customer using AI chat.

Consumer discovery is treated as a pre-company context of the customer-side
participant, not as an access grant or automatic CRM relationship. Each
applicable quadrant must also consider the three entry paths:

- Search or browse discovery.
- Invite.
- Direct link.

Research findings must state which quadrant and entry path they apply to.
Evidence from one quadrant must not be generalized to another without an
explicit rationale.

## Key research questions

### Staff and owner work

- How do owners currently manage products, price differences, customers,
  orders, chat, invoices, delivery, and follow-up from a phone?
- Which steps are repeated, error-prone, delayed, or copied between apps?
- What information must be visible immediately when a new order or message
  arrives?
- Which business actions require a structured screen, and which could start
  from a natural-language request?
- What must an AI assistant show before an owner trusts and confirms a write
  or high-risk action?
- How do owners distinguish personal, customer-list, group-list, default-list,
  and base prices in their own language?

### Consumer and customer work

- How do people currently find a small business, evaluate it, choose products,
  and decide to place an order?
- What differs when entry comes from search, an invite, or a direct link?
- What context is needed before account creation feels justified?
- What should remain available before a CRM customer record exists?
- What makes cart, checkout, redirect-to-chat, order clarification, and order
  status understandable?
- How do B2B customers expect requisites, invoices, delivery notes, and QES
  signing to fit into the same order conversation?

### Classic UI and AI chat

- Which jobs are faster or clearer as navigation, forms, lists, and cards?
- Which jobs benefit from conversational intent capture or summarization?
- When should AI open or prefill a classic form instead of acting directly?
- What evidence, preview, undo path, or confirmation does each action need?
- How should AI communicate limitations, loading, offline state, and failure?
- Can users move between classic and AI paths without losing context or
  wondering whether an action already happened?

### Mobile, content, and accessibility

- Which devices, screen sizes, network conditions, and notification habits
  shape daily use?
- Which Ukrainian terms feel natural for orders, price levels, company roles,
  documents, delivery, and signing?
- Where do users need larger targets, reduced density, clearer status,
  screen-reader support, or alternatives to streaming text?
- Which information is unsafe or uncomfortable to say aloud or enter into AI
  chat in a shared environment?

## Methods

### 1. Desk research

Review approved product and architecture decisions, the V1 audit, and existing
usage shapes before interviewing. Extract assumptions rather than presenting
repository decisions as user evidence.

Outputs:

- Initial assumption register.
- Domain and terminology prompts for interviews.
- Known constraints that research may inform but not reopen.

### 2. Competitor interaction-pattern audit

SHO-6 examines Instagram, Telegram, Monobank, Nova Poshta, Poster, Checkbox,
and Horoshop on mobile.

For each product, record:

- The user goal and observed interaction.
- Navigation, onboarding, chat/commerce, payment, and notification patterns.
- What users are likely already trained to expect.
- Relevance to the coverage quadrants and entry paths.
- An `adopt`, `adapt`, or `avoid` recommendation with evidence and rationale.

The audit evaluates patterns, not visual imitation or feature parity.

### 3. Semi-structured real-user interviews

SHO-7 uses 35–45 minute remote or in-person sessions led by the human owner.
An agent prepares the guide and synthesizes de-identified notes.

Each session should include:

1. Recent-behavior walkthrough: a real order, catalog update, customer
   interaction, or purchase rather than hypothetical preferences.
2. Current-tool map: apps, handoffs, copied data, notifications, and failure
   recovery.
3. Entry-path discussion: discovery, invite, and direct link where relevant.
4. Classic-versus-AI prompts using neutral scenarios without selling either
   approach.
5. Trust and confirmation probes for writes, documents, payments, deletion,
   and signing.
6. Device, connectivity, language, accessibility, and privacy context.

The interviewer must ask for examples before asking for desired features and
must separate observed behavior from participant opinion.

### 4. Synthesis

Interview notes and competitor observations are coded into:

- Jobs, triggers, desired outcomes, and current workarounds.
- Pain points and failure-recovery behavior.
- Trusted patterns and terminology.
- Classic-only, AI-suitable, and handoff-required interactions.
- Differences between staff, consumer, and customer contexts.
- Confirmed evidence, conflicting evidence, and unresolved assumptions.

The RESEARCH summary converts findings into `adopt`, `adapt`, or `avoid`
recommendations. It must retain traceability to de-identified evidence.

## Recruiting plan

### Target sample

Recruit eight participants:

- Four Ukrainian micro-business owners or staff who sell products through
  chat or social channels and operate mainly from a phone.
- Four customers who have recently discovered or ordered from a Ukrainian
  micro-business through social, chat, invite, or direct-link flows.

A minimum of six completed sessions, three in each group, is acceptable only
if the owner records the recruitment shortfall and the evidence is sufficient
to draft both personas without hiding open assumptions.

### Sampling criteria

The staff sample should aim to include:

- At least one home or small-batch product business close to the reference
  confectionery case.
- Different levels of operational complexity: simple base pricing and
  differentiated customer/group pricing.
- At least one participant who uses invoices or other B2B documents.
- A mix of high and low familiarity with AI assistants.

The customer sample should aim to include:

- Recent experience ordering from a small business on a phone.
- Exposure across discovery, invite, and direct-link entry paths where
  recruiting permits.
- At least one B2B customer or sole proprietor who has handled invoices or
  signed business documents.
- A mix of high and low familiarity with AI assistants.

The same person may provide evidence about consumer discovery and later
company-scoped customer behavior. Those contexts must be marked separately in
the notes.

### Recruiting channels

Use channels available to the owner in this order:

1. Existing Showzy or reference-business contacts.
2. Customers of participating businesses, invited without pressure from the
   business owner.
3. Owner's Ukrainian small-business network and referrals.

Avoid recruiting only from one business. Where possible, no more than two
customer participants should come from the same company's network.

Exclude project contributors, professional product designers, and
participants whose relevant workflow is exclusively desktop-based. Prior
Showzy experience is useful but not required.

### Contact and scheduling

- Use a short screening message that states the research purpose, session
  length, voluntary nature, and whether recording is requested.
- Schedule on the participant's preferred channel and device.
- Offer recording only with explicit consent; otherwise use written notes.
- Incentives are optional and decided by the owner before outreach. Lack of an
  incentive must not be hidden in recruitment reporting.
- Maintain two replacement candidates per participant group when possible.

## Evidence handling and participant safety

- Store names, contact details, recordings, and raw sensitive notes only in
  owner-controlled private storage, never in the repository.
- Use participant codes such as `S1` and `C1` in repository artifacts.
- Obtain explicit consent for participation and separate consent for
  recording.
- Do not collect authentication codes, financial credentials, QES keys,
  customer lists, or identifiable third-party business data.
- Redact personal and commercially sensitive details during synthesis.
- Allow participants to skip any question or stop the session.
- Report quotes only in de-identified form.

## Timeline and dependencies

The expected duration is eight working days after this brief is approved:

- Day 0: owner approves the brief and confirms access to recruiting channels.
- Days 1–2: SHO-6 and SHO-7 start in parallel; desk review, audit setup,
  screening, interview guide, and outreach.
- Days 2–6: competitor audit and interviews proceed in parallel.
- Days 5–7: rolling synthesis, evidence-gap check, and replacement interviews
  if needed.
- Day 8: consolidated research summary and Approval #1 review.

The schedule may move with participant availability. Scope must not be reduced
silently to preserve the dates.

## Deliverables

RESEARCH produces:

- `docs/design/research/brief.md` — this approved brief.
- `docs/design/research/competitor-audit.md` — SHO-6.
- `docs/design/research/personas.md` — SHO-7 personas, JTBD, evidence, and
  assumptions.
- A consolidated research summary for SHO-8 with recommendations and
  unresolved risks.

No production UI, design tokens, component contracts, or Figma prototypes are
created during RESEARCH.

## Out of scope

- Designing or implementing product screens.
- Selecting final visual styles, tokens, icons, or component APIs.
- Testing completed prototypes; that belongs to VALIDATE.
- Reopening the mobile-first strategy, account requirement, action-registry
  parity, or chat/order ownership.
- Full web UX, browser continuation, or desktop document-template editing.
- Monobank acquiring, bank-statement accounting, subscriptions, workflow
  constructor, or other post-launch phases.
- Social feed, follows, likes, comments, anonymous browsing, guest checkout,
  Meta messaging, semantic search, LiqPay, or Meest.
- Market sizing, pricing Showzy subscriptions, brand strategy, or broad
  customer-acquisition research.
- Collecting production credentials, private keys, or identifiable customer
  datasets.

## Risks and mitigations

- **Convenience-sample bias:** recruit from more than one business and label
  limits in the summary.
- **Feature-request bias:** anchor interviews in recent behavior before
  discussing desired capabilities.
- **AI novelty bias:** compare concrete tasks and confirmation needs, not
  general enthusiasm for AI.
- **Owner-interviewer bias:** use a stable guide, neutral prompts, and
  de-identified agent-assisted synthesis.
- **Missing B2B evidence:** make it an explicit recruitment target; if unmet,
  carry it as a validation risk instead of inventing behavior.
- **Scope expansion:** map every finding to V2 launch, deferred, or dropped
  scope before making a recommendation.
- **Sensitive-data exposure:** use participant codes and keep raw data out of
  the repository.

## Completion and approval criteria

This brief is approved when the human owner confirms that:

- Goals and questions cover staff/customer × classic UI/AI and the consumer
  discovery context.
- Discovery, invite, and direct-link entry paths are represented.
- The competitor audit and interview methods are executable.
- The recruiting target, channels, session format, and evidence handling are
  realistic.
- The timeline and owner-led responsibilities are accepted.
- Out-of-scope items match the approved V2 launch scope.

Owner approval unblocks SHO-6 and SHO-7. Approval of this brief does not count
as Approval #1; that checkpoint occurs after both research outputs are
synthesized in SHO-8.
