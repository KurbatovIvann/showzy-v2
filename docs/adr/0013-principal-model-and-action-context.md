# ADR-0013: Principal model — staff, customer, public, system, consumer, account

- **Status**: Accepted
- **Date**: 2026-08-17
- **Deciders**: owner (+ Claude Fable 5, foundation review)

## Context

Blueprint §4 sketches the action context as
`ctx: { db, userId, companyId, membership, emit }`. That shape only describes
a **staff** caller — an authenticated member of the company being acted on.
But the canonical flow (scope §1.1) requires callers who are *not* members:

- a **customer** browsing another company's profile, filling a cart, placing
  an order, chatting, and signing documents;
- **public** (unauthenticated) reads of a public company profile/catalog;
- **system** callers: workers, cron, webhook handlers, the outbox dispatcher.

Without an explicit model, implementing agents will either require company
membership for checkout (breaking the product) or accept `companyId` from
input as an access grant (breaking tenant isolation, invariant §2.1-1).
A user can simultaneously be staff of one company and a customer of others.

## Decision

Every action declares exactly one **principal mode**; the action context is a
discriminated union over that mode:

- **`staff`** — authenticated user acting *as a member* of a company.
  The transport supplies an active-company selector (`x-company-id`); the
  core context factory loads and verifies the corresponding membership
  before deriving `ctx.companyId` (v1 `has_company_permission` model). The
  selector is never authority. `permissions` are evaluated against the
  loaded membership's role/overrides. This is the panel surface.
- **`customer`** — authenticated user acting *on* a company they do not
  manage. The target company is **never taken from input as a grant**: it is
  resolved by the action's typed server-only
  `resolveTarget(input, { tx, principal: { userId } })` callback, which loads
  the referenced resource (public company slug, own order, own conversation,
  invite token) and verifies ownership/visibility.
  `ctx` carries `userId` and the typed resolved target. This is the cabinet
  surface.
- **`public`** — no authentication. Only explicitly public reads. These also
  require a typed `resolveTarget(input, { tx, principal })` callback proving
  that the target company/resource is public; a slug or ID is only a
  selector. Rate-limited harder.
- **`system`** — workers, cron, webhook handlers, outbox consumers. Carries a
  named service identity for audit (`actor_id = system:<name>`) and an
  explicit tenant scope set by the enqueuing code, never ambient authority.
- **`consumer`** (ADR-0018) — authenticated user performing **global
  discovery** without company scope. Read-only; no `companyId`; no
  `resolveTarget`; no audit/events. Used for cross-company search and
  published-entity browsing. A user transitions to `customer`/`public` when
  invoking a company-specific action.
- **`account`** — authenticated user managing **their own account-level
  resources** without an active company context. No `companyId`; `userId`
  is present and is the sole authorization basis (actions are scoped to
  own-user data). Used for pre-tenant operations: creating a company,
  listing/restoring own companies, managing personal profile/settings.
  May perform writes (unlike `consumer`). `permissions` must be `[]`
  (no company RBAC applies). A user transitions to `staff` by selecting a
  company from the list returned by an `account` action.

One action = one principal mode. A capability needed by both panel and
cabinet becomes two actions (e.g. `orders.listForCompany` /
`orders.listMine`) sharing a module service — the authorization logic is
never conditional on "which kind of caller might this be".

Resource identifiers of another company (product id, company slug, order id)
MAY appear in input; they are inputs to server-side resolution, never grants.
The mandatory cross-tenant test suite (§2.1-1) is parameterized over all six
modes (the consumer fixture verifies published-only access and no CRM side
effects; the account fixture verifies own-user-only access).

## Alternatives considered

- **One flexible context with optional fields** (`companyId?`,
  `membership?`) — rejected: every handler re-derives what kind of caller it
  has; agents will forget branches; the type system can't force the checks.
- **Separate API surfaces (panel API / cabinet API) instead of principal
  modes** — rejected: duplicates the registry and breaks "one action registry
  as single source of truth" (ADR-0008); the mode achieves the same
  separation inside one registry.
- **Modeling customers as zero-permission members** — rejected: pollutes
  membership semantics, makes RBAC queries lie, and still doesn't cover
  public/system callers.

## Consequences

- `defineAction` gains a required `principal` field; `packages/core` exposes
  per-mode context types and requires typed target resolvers for
  `customer`/`public`. The contract check (CI) fails on actions without them.
- The cross-tenant test harness gains per-mode fixtures: staff of company A
  vs. data of company B; customer X vs. orders of customer Y; public vs.
  non-public company; system job scoped to A touching B; consumer accessing
  unpublished data; account user A accessing account user B's companies.
- Specs must state the principal mode for every action (spec template
  updated).
- better-auth integration (phase 0) must expose the session → principal
  resolution in one place; the staff factory verifies the transport's active
  company selector; webhooks/workers construct `system` contexts through a
  single factory, never ad-hoc.
