# Experience Foundation — Research Summary

> Status: Approval #1 granted by the owner on 2026-08-17  
> Linear: SHO-8 · Stage: RESEARCH  
> Evidence model: desk research and internal assumptions only

## Approval #1 decision

The human owner approved this summary as the input to DEFINE on 2026-08-17.

Approval establishes:

- The evidence-backed interaction directions below become constraints for
  information architecture, journey maps, content, and accessibility work.
- Open questions remain explicit and must be resolved through design
  reasoning or later internal prototype evaluation.
- No persona, preference, or representative Ukrainian-user claim is implied.

## Sources and evidence boundaries

This summary combines:

- Approved product and architecture constraints from `docs/blueprint.md`,
  `docs/scope.md`, and accepted ADRs.
- Documented V1 behavior from `docs/reference/v1-backend-audit.md`.
- Official-source competitor evidence and marked inference from
  `docs/design/research/competitor-audit.md`.
- Owner decisions recorded in the approved research brief and plan.

It does not include:

- External interviews, surveys, or usability sessions.
- Evidence-based personas or jobs-to-be-done.
- Authenticated or firsthand testing of competitor products.
- Independent reference-user observations collected during RESEARCH.

The owner and one owner-designated reference user will evaluate prototypes
later. Those findings must be labeled `internal evaluation only`.

## Product constraints

The following are approved decisions, not research findings:

1. Showzy is a business operating platform with authenticated consumer
   discovery, not a social marketplace.
2. The V2 launch is mobile-first and includes staff, consumer discovery,
   customer, chat, order, document, and AI surfaces in one Expo app.
3. Full web product flows are post-launch.
4. Orders require an authenticated account.
5. Three entry paths coexist: discovery, invite, and direct link.
6. Checkout redirects to chat with an order card.
7. Orders own order state; chat and notifications are projections.
8. Classic UI and AI chat invoke the same typed actions.
9. High-risk and irreversible operations require visible human confirmation.
10. QES keys remain client-side and inaccessible to the server or AI.
11. Customer/public company scope is resolved and authorized per action; link
    or input identifiers never grant tenant access.

## Documented V1 behavior retained as context

These are implementation/usage shapes present in V1, not proof of user
preference:

- Company-to-customer chat supports messages, edits/deletes, reactions,
  typing, read receipts, and user/conversation rooms.
- Realtime, push, email, SMS, and a transactional outbox already form the
  operational notification pattern.
- Catalog supports products, variants, options, images, and SKU/price data.
- Pricing uses five levels: personal, customer price list, group price list,
  default price list, and base price.
- Orders store item snapshots and an audit trail.
- Documents support templates, generated PDFs, counterparties, and QES
  signatures.
- Delivery integrates Nova Poshta city, warehouse, and street data.
- The existing assistant already performs tool calls and streams results, but
  its tools are ad hoc rather than generated from one action registry.
- V1 authorization is distributed across extensive RLS/RPC logic; V2 replaces
  it with verified action contexts and permissions.

## Synthesis: patterns to adopt

### One domain object across every surface

Classic screens, AI chat, notifications, and links must resolve the same
product, cart, order, payment, delivery, conversation, or document.

Implications:

- Cards store stable IDs, not copied domain status.
- Opening a push or link fetches current authorized state.
- AI result cards and classic detail screens remain interchangeable.
- Retry cannot create parallel hidden copies of the same operation.

Evidence:

- Telegram intent-preserving links.
- Nova Poshta object cards.
- Poster operational queues.
- Horoshop order/payment links.
- Showzy's projection and one-data-path invariants.

### Status-first, actionable mobile work

Staff surfaces should present work as compact queues grouped by state with one
dominant next action, search, and filters.

Customer surfaces should present concise object state plus only currently valid
actions.

Evidence:

- Poster status-grouped order processing.
- Nova Poshta live shipment queue and state-dependent actions.
- Checkbox receipt/history recovery.
- Horoshop order status and payment continuation.

### Context-preserving entry

Discovery, invite, direct link, QR, push, and AI navigation must preserve
intent through install and authentication, then perform independent visibility
and ownership checks.

Evidence:

- Instagram content-to-profile/chat behavior.
- Telegram business links with suggested intent.
- Nova Poshta deep object actions.
- Horoshop order-specific payment continuation.

### Familiar customer commerce flow

Discovery should follow recognizable
search/category/filter → product → cart → checkout behavior. AI discovery
returns the same products and cart rather than a separate conversational cart.

Evidence:

- Instagram visual discovery.
- Horoshop catalog and checkout conventions.
- Showzy's authenticated consumer-discovery decision.

### Contextual chat as the collaboration surface

Chat is primary for clarification and collaboration, but every consequential
card or action remains attached to its domain object.

Evidence:

- Telegram chat-as-workspace expectations.
- Nova Poshta object-specific courier communication.
- V1 realtime chat behavior.
- Showzy's canonical checkout-to-chat flow.

### Explicit proposal and confirmation

Risky actions must separate preparation from execution and show:

- Actor and company context.
- Target object.
- Amount or business effect.
- Destination or counterparty.
- Reversibility and failure consequence.
- Final human confirmation.

Evidence:

- monobank confirmation and status patterns.
- Checkbox separation of payment and fiscal effect.
- Showzy's human-in-the-loop invariant.

### Durable asynchronous state and recovery

Every asynchronous operation needs explicit pending, success, failure,
partial-success, retry, and reversal states where applicable.

Recovery must:

1. Identify the failed prerequisite.
2. Preserve valid progress.
3. Offer one safe retry.
4. Escalate when retry cannot resolve the problem.

Evidence:

- Poster synchronization indicators.
- Nova Poshta locker recovery.
- Checkbox fiscal retry/history.
- monobank transaction history and reversal.

### Durable notification center

Push is a transport, not the source of truth. Every actionable notification
must lead to current in-app state.

Evidence:

- Nova Poshta in-app notification history.
- V1 push/outbox architecture.
- Showzy's projection invariant.

### Accessible state semantics

Status, synchronization, risk, and completion must use text, iconography, and
structure rather than color alone.

Evidence:

- monobank accessibility declarations.
- Instagram/Telegram accessibility support.
- Poster color-only sync risk.

## Synthesis: patterns to adapt

### Chat-first, not chat-only

Telegram demonstrates chat efficiency, but structured catalog, pricing,
documents, and operational queues need dedicated classic surfaces.

Adaptation:

- Use chat for intent, clarification, summaries, and contextual cards.
- Open classic forms for dense review, comparison, and irreversible actions.
- Preserve context in both directions.

### AI as another action surface

Competitor evidence for broad AI operations is weak.

Adaptation:

- AI calls the same actions as classic UI.
- Results use structured domain cards.
- Writes show a preview and completion evidence.
- High-risk actions transfer to a human-controlled confirmation surface.
- AI and human authorship remain visible.

### Low-friction ordering under an account requirement

Horoshop quick order is familiar but conflicts with Showzy's no-guest-order
decision.

Adaptation:

- Keep discovery and cart low-friction.
- Delay authentication until the first account-required action.
- Preserve the cart and return target through sign-in.
- State clearly when staff confirmation is still required.

### Bounded offline support

Poster, Checkbox, and Nova Poshta prove that offline support is valuable but
domain-specific.

Adaptation:

- Cache read-only or already-authorized critical information.
- Queue only idempotent, safely replayable actions.
- Show last synchronization time and pending count.
- Block operations whose current authorization or legal effect cannot be
  guaranteed offline.

### Progressive legal complexity

Checkbox exposes statutory concepts deeply because fiscalization is its core
job. Showzy must preserve legal precision without making every workflow a tax
console.

Adaptation:

- Introduce invoices, fiscal status, QES, and legal consequences only where
  they apply.
- Keep legal state inspectable and auditable.
- Use plain-language summaries before technical detail.

### Inbound triage

Instagram and Telegram separate known and unknown senders.

Adaptation:

- Distinguish existing customers, new inbound requests, and suspicious
  contact.
- Never hide a legitimate first order solely because the sender is unknown.
- Show why a conversation is in a queue and how staff can reclassify it.

## Synthesis: patterns to avoid

- Engagement-first feeds, follows, likes, and endless consumption.
- Chat, notifications, email, or AI owning copied domain status.
- Message/link content treated as authorization.
- Channel-dependent truth or recovery.
- Business-critical drafts stored on one device only.
- Silent account creation.
- Context-free “Allow” confirmation.
- Color-only status or opaque synchronization.
- Bank-grade friction on low-risk discovery.
- Restaurant tables, shifts, or fiscal entities becoming global navigation.
- Separate mobile and desktop information structures that can drift.
- Server- or cloud-held QES keys.
- Claims of verification, encryption, payment safety, or AI authority that
  the implemented protocol does not provide.

## Internal assumption register

These items are not independently validated and must remain testable:

### A1 — Reference operating model

Assumption: the highest-value staff experience is optimized around a
phone-primary micro-business owner who moves between catalog, customer chat,
orders, delivery, and documents throughout the day.

Basis: product-owner decision and the reference confectionery case.

### A2 — Chat centrality

Assumption: redirecting checkout to chat improves clarification and
collaboration without making structured order state harder to find.

Basis: approved product direction and V1 operational shape.

### A3 — Five-level pricing comprehension

Assumption: staff can understand the five-level pricing model when terminology
and effective-price explanation are clear.

Basis: owner-confirmed business need; terminology remains untested.

### A4 — AI usefulness

Assumption: AI is most useful for intent capture, summaries, navigation, and
form preparation, while classic UI remains preferred for dense comparison and
confirmation.

Basis: architecture decision and competitor synthesis, not user evidence.

### A5 — Consumer-to-customer transition

Assumption: users can understand the difference between global discovery and
a company-scoped customer context if company identity and transition are
visible.

Basis: ADR-0018. Interaction expression remains untested.

### A6 — Account timing

Assumption: requiring authentication at the first company-scoped or
order-creation action is acceptable if discovery/cart state survives sign-in.

Basis: security-over-conversion owner decision. Conversion impact is unknown.

### A7 — Internal evaluation sufficiency

Assumption: review by the owner and one designated reference user is enough to
open the UX Gate for initial implementation.

Basis: explicit resource constraint and owner decision. It is not
representative validation.

## Open questions for DEFINE

1. What is the default mobile navigation for staff, consumer discovery, and
   company-scoped customer contexts?
2. How does a multi-role user see and switch the active context without
   accidental cross-company action?
3. Where does AI live globally, and when does it become company- or
   object-scoped?
4. Which information appears in a discovery result versus a company profile?
5. At what exact action does authentication become mandatory, and how is
   intent restored afterward?
6. How are five pricing levels named and how is the effective source
   explained?
7. Which staff queues exist on the home surface, and how are they prioritized?
8. Which notifications deserve push, silent in-app state, or grouping?
9. Which actions may operate offline, and which must be disabled?
10. How are AI/human authorship, action status, and retry represented in chat?
11. What summary is required before order confirmation, payment, deletion,
    document generation, and QES signing?
12. How are unpublished companies/products, expired links, no results, and
    deactivated items explained?
13. Which Ukrainian terms require owner/reference-user resolution before
    component copy is frozen?
14. What evidence must the UX Gate record when evaluation is internal only?

## Required outputs from DEFINE

### Information architecture

- One app binary with explicit staff, consumer, and company-customer contexts.
- Clear active-company identity.
- Global and contextual AI entry points.
- Staff queues and customer object navigation.
- Discovery → profile → company transition.

### Journey maps

- Classic and AI paths for discovery, catalog, order, chat, and documents.
- Invite and direct-link continuation through install/sign-in.
- AI ↔ classic handoffs.
- Pending, duplicate, partial success, offline, retry, expired, unpublished,
  and suspicious-inbound states.

### Content principles

- Canonical Ukrainian terms for roles, pricing, order/document state, and QES.
- Plain-language confirmation and recovery.
- AI voice that never obscures action effect or authorship.

### Accessibility baseline

- State semantics beyond color.
- Screen-reader labels and focus order for dynamic cards.
- Alternatives to streaming text.
- Touch targets, large text, reduced motion, and keyboard/safe-area behavior.

## Approval #1 checklist

- [x] Product constraints are accurate.
- [x] V1 behavior is not presented as preference evidence.
- [x] Competitor facts and inferences remain distinguishable.
- [x] ADOPT/ADAPT/AVOID directions are acceptable.
- [x] Internal assumptions and open questions are complete enough for DEFINE.
- [x] External user research or validation is not claimed.
- [x] The owner approves DEFINE to start.

## Research conclusion

The strongest direction is a mobile operating workspace that combines:

- Familiar catalog discovery.
- Status-first staff/customer object cards.
- Contextual chat collaboration.
- Intent-preserving links and notifications.
- monobank-style consequential confirmation.
- Explicit asynchronous recovery.
- One domain truth across classic UI and AI.

The main unresolved risk is not technical feasibility but interaction clarity
across roles, companies, classic UI, AI chat, and the discovery-to-customer
transition. DEFINE must make those context boundaries visible. Internal
prototype evaluation must then test them without overstating its evidence.
