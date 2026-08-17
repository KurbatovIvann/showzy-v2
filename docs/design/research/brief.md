# Experience Foundation — Research Brief

> Status: Approved, owner-revised on 2026-08-17  
> Linear: SHO-5 · Stage: RESEARCH · Owner: human product owner

## Purpose

Build a practical evidence base for the information architecture, journey
maps, design system, and representative prototypes of Showzy V2 before product
UI work begins.

The available research methods are deliberately limited to:

- Desk research against approved product decisions and V1 behavior.
- An evidence-backed audit of products familiar to Ukrainian users.
- Internal review by the human owner and one owner-designated reference user.

The project will not recruit or compensate external participants. It therefore
does not claim representative target-user research, evidence-based personas,
or external usability validation. Internal observations are product input,
not population-level evidence.

This brief authorizes SHO-6, the Ukrainian-market and competitor audit. SHO-7
(personas and external interviews) is cancelled by owner decision.

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

1. Identify mobile interaction patterns that Ukrainian users are likely to
   recognize from Instagram, Telegram, monobank, Nova Poshta, Poster,
   Checkbox, and Horoshop.
2. Document known V1 workflow shapes and explicit owner/reference-user
   assumptions without presenting them as independent user evidence.
3. Define testable questions about classic screens, AI chat, and handoffs for
   later internal prototype evaluation.
4. Identify trust and confirmation patterns relevant to business changes,
   payments, documents, and QES-related actions.
5. Map the expected transition from discovery, invite, or direct link into a
   company-scoped customer context.
6. Capture likely Ukrainian mobile constraints and terminology questions that
   DEFINE and PROTOTYPE must address.
7. Record evidence limitations and assumptions that remain unvalidated.

## Coverage model

The audit and internal evaluation matrix has four quadrants:

- Staff/owner using classic UI.
- Staff/owner using AI chat.
- Customer using classic UI.
- Customer using AI chat.

Consumer discovery is treated as a pre-company context of the customer-side
user, not as an access grant or automatic CRM relationship. Each applicable
quadrant must consider:

- Search or browse discovery.
- Invite.
- Direct link.

Every finding must state its source and applicable quadrant. Documented
competitor behavior, repository constraints, owner assumptions, and reference
user observations must remain distinguishable.

## Key evaluation questions

### Staff and owner work

- Which product, pricing, customer, order, chat, invoice, delivery, and
  follow-up actions need immediate mobile access?
- Which actions require structured forms or previews rather than
  conversational execution?
- What must AI show before a write or high-risk action is confirmed?
- Which terms best distinguish personal, customer-list, group-list,
  default-list, and base prices?

### Consumer and customer work

- What information supports discovery and trust before entering a company?
- What differs between search, invite, and direct-link entry?
- When is account creation justified?
- What must remain possible before a CRM customer record exists?
- How should cart, checkout, redirect-to-chat, clarification, and status be
  presented?
- How should B2B documents and QES fit into the same order conversation?

### Classic UI and AI chat

- Which jobs are clearer as navigation, forms, lists, and cards?
- Which jobs benefit from intent capture or summarization in chat?
- When should AI open or prefill a classic form instead of acting?
- What preview, confirmation, undo path, and completion evidence is needed?
- How should loading, offline state, retry, and failure be communicated?
- Can users switch modes without losing context or duplicating an action?

### Mobile, content, and accessibility

- Which information and actions must work one-handed and on small screens?
- What must remain understandable during intermittent connectivity?
- Which events require push notifications?
- Which Ukrainian terms are natural for roles, prices, orders, documents,
  delivery, and signing?
- What alternatives are needed for streaming text and dense generative cards?

## Methods

### 1. Desk research

Review approved product and architecture decisions, the V1 audit, and existing
usage shapes. Produce an assumption register that labels each item as:

- Approved product constraint.
- Documented V1 behavior.
- Owner assumption.
- Reference-user observation.
- Open question.

Repository decisions constrain the design but are not user evidence.

### 2. Competitor interaction-pattern audit

SHO-6 examines Instagram, Telegram, monobank, Nova Poshta, Poster, Checkbox,
and Horoshop on mobile.

For each product, record:

- Source URL and access date.
- Documented interaction and its user goal.
- Navigation, onboarding, chat/commerce, payment, and notification patterns.
- Loading, empty, error, offline, retry, and trust patterns where evidenced.
- What Ukrainian users are likely trained to expect, explicitly marked as an
  inference.
- Relevance to the coverage quadrants and entry paths.
- An `adopt`, `adapt`, or `avoid` recommendation with rationale.

The audit evaluates patterns, not visual imitation or feature parity.

### 3. Internal prototype evaluation

External sessions are not part of RESEARCH or VALIDATE. Once representative
prototypes exist, the human owner and one owner-designated reference user
evaluate the agreed journeys.

Internal findings must:

- Identify the reviewer and reviewer role without storing unnecessary
  personal data.
- Distinguish observed task failure from preference.
- Record the tested prototype version and journey.
- Cover both classic and AI paths where applicable.
- Include severity, recommendation, and owner disposition.
- Carry the explicit limitation `internal evaluation only`.

Internal evaluation can reject or revise a design. It cannot establish broad
Ukrainian-user preference or usability.

## Timeline and dependencies

After the approved brief:

- SHO-6 performs the competitor audit.
- SHO-8 synthesizes the audit, V1 constraints, assumptions, and open
  questions, then receives Approval #1.
- DEFINE proceeds from the approved summary.
- PROTOTYPE is evaluated internally during VALIDATE by the owner and reference
  user.

Scope must not be expanded or evidence limitations hidden to preserve dates.

## Deliverables

RESEARCH produces:

- `docs/design/research/brief.md` — this owner-revised brief.
- `docs/design/research/competitor-audit.md` — SHO-6.
- A consolidated research summary for SHO-8 with recommendations,
  assumptions, evidence limitations, and open risks.

No persona artifact, participant repository, production UI, design tokens,
component contracts, or Figma prototypes are created during RESEARCH.

## Out of scope

- External participant recruitment, compensation, interviews, or surveys.
- Evidence-based personas or claims about representative user preference.
- Designing or implementing product screens.
- Selecting final visual styles, tokens, icons, or component APIs.
- Reopening mobile-first strategy, account requirement, action-registry
  parity, or chat/order ownership.
- Full web UX, browser continuation, or desktop document-template editing.
- Post-launch acquiring, banking/accounting, subscriptions, and workflow
  construction.
- Social feed, follows, likes, comments, anonymous browsing, guest checkout,
  Meta messaging, semantic search, LiqPay, or Meest.
- Market sizing, subscription pricing, or broad acquisition research.

## Risks and mitigations

- **Internal-review bias:** label all owner/reference-user findings and avoid
  generalizing them.
- **Missing behavioral evidence:** preserve open questions for later product
  analytics, support feedback, or optional future research.
- **Competitor inference:** separate documented interaction from interpretation.
- **AI novelty bias:** compare concrete tasks and confirmation needs instead
  of general enthusiasm.
- **Scope expansion:** map every recommendation to launch, deferred, or
  dropped scope.
- **False validation claim:** UX Gate records `internal evaluation only`.

## Completion and approval criteria

The brief is approved when the human owner confirms:

- The audit covers staff/customer × classic UI/AI and consumer discovery.
- Discovery, invite, and direct-link paths are represented.
- Competitor and internal-review methods are executable without recruitment.
- Evidence types and limitations remain explicit.
- Out-of-scope items match approved V2 launch scope.

Owner approval unblocks SHO-6. Approval of this brief does not count as
Approval #1; that checkpoint occurs after SHO-6 is synthesized in SHO-8.
