# ADR-0018: Consumer discovery and the `consumer` principal

- **Status**: Accepted
- **Date**: 2026-08-17
- **Deciders**: Human owner
- **Amends**: ADR-0013 (adds a fifth principal mode)

## Context

Showzy V2 is a **business operating platform with a consumer discovery
surface** — not a multi-seller marketplace or social hub. The v1 product
allowed any authenticated user to search, browse, and enter companies without
an invitation. The v2 documentation mistakenly conflated this capability with
"marketplace browsing hub" social mechanics (follows, likes, feed,
embeddings) and dropped both together.

Three entry paths into a company must coexist at launch:

1. **Discovery** — an authenticated user searches or browses published
   companies/products inside the app.
2. **Invite** — a token/link that creates or enriches a CRM relationship and
   optionally bootstraps a chat conversation.
3. **Direct link** — a Universal/App Link to a specific company profile or
   product, accessible with or without authentication.

ADR-0013 defines four principal modes: `staff`, `customer`, `public`,
`system`. Global authenticated discovery does not fit any of them:

- `customer` resolves a single company per action via `resolveTarget` — it
  cannot represent a cross-company search result list.
- `public` is unauthenticated — it cannot track rate limits by user or
  personalize discovery surfaces.
- `staff` requires company membership.
- `system` is for machine actors.

A user can simultaneously hold CRM records in many companies; `customer`
context selects one company per action invocation. Discovery precedes the
choice of a specific company.

## Decision

Add a fifth principal mode — **`consumer`** — with these invariants:

| Property | Value |
| --- | --- |
| Authentication | Required (better-auth session) |
| `companyId` | `null` — no tenant scope |
| `userId` | Authenticated user ID |
| Allowed risk levels | `read` only |
| `resolveTarget` | Not applicable (no tenant to resolve) |
| `permissions` | Must be `[]` (no company RBAC) |
| `transport` | `client` |
| `aiExposure` | `exposed` or `internal` |
| `audit` | `false` (global discovery reads do not enter company audit) |
| `idempotent` | `false` |
| `emits` | `[]` |
| Rate limiting | Per-user; tighter than staff, looser than public |
| Logging | Request ID, actor user, channel; no company in structured logs |
| Data access | Only declared global discovery projections and published facts |

### Transition from discovery to company context

A search result or profile view does not grant company scope. The user
transitions to a company-scoped principal (`customer` or `public`) when they
invoke a company-specific action (view full profile, open chat, add to cart).
That action has its own `resolveTarget` proving visibility/ownership as
always.

### CRM customer creation

A CRM `company_customers` record is created **only** by:

- a staff member manually adding the customer; or
- the checkout/order-creation action atomically linking or creating the
  record (matching v1 `create_order_secure` phone/email-first logic).

Discovery, profile browsing, cart interaction, and chat do not create CRM
records. Chat (`openMyConversation`) sets `company_customer_id` when a CRM
row already exists; otherwise it remains `null`.

### Publication / visibility

Only **published** companies and **active published** products appear in
consumer discovery results. The `companies` module owns a `published` state
on the company profile; the `catalog` module owns product active/published
status. The exact publication lifecycle is defined in the owning specs; this
ADR only requires that discovery actions never surface unpublished entities.

### What remains dropped

Social marketplace mechanics are still out of scope: follows, likes,
comments, social feed, follower-based popularity sorting, vector/semantic
search, geo-radius discovery, and anonymous browsing without authentication.

## Alternatives considered

- **Extend `customer` with an optional global mode** — rejected: complicates
  the existing company-scoped `resolveTarget` contract and blurs the
  discriminated union guarantee; every `customer` handler would need to
  check whether `companyId` exists.
- **Use `public` for all discovery (auth optional)** — rejected: loses
  per-user rate limiting, cannot personalize (recent companies, language
  preference), and conflates link-preview reads with intentional browse.
- **Defer discovery entirely to post-launch** — rejected by the owner: v1
  already has this capability; removing it regresses the product.
- **Keep only invite + direct link entry (no search)** — rejected: forces
  customers to know the exact company link; contradicts the v1 user
  expectation and the owner's stated intent.

## Consequences

- `packages/core` gains a `ConsumerCtx` type: `{ db: ReadTx, userId, requestId, correlationId, channel, clientIp }` with no `companyId`.
- The contract check (CI) validates: `consumer` actions must be `risk: read`,
  `permissions: []`, `audit: false`, `emits: []`, `transport: client`.
- The cross-tenant test harness gains a consumer fixture: verify consumer
  cannot access unpublished companies or products; verify no CRM side effects.
- ADR-0013's principal list becomes `staff | customer | public | system |
  consumer`; the spec template gains the consumer row; `.cursor/rules/`
  conventions and prohibitions are updated.
- The `search` module (global FTS/trigram projections) is the primary consumer
  of `consumer`-principal actions; `companies` and `catalog` expose
  consumer-compatible published reads.
- `business_categories` and `company_business_categories` (v1 taxonomy) are
  carried over as company profile metadata and discovery filter dimensions,
  owned by `companies`.
- Phase numbering is updated to include a dedicated Consumer Discovery phase.
- The Experience Foundation must include a discovery journey (search → profile
  → cart) alongside invite and direct-link entry variants.
