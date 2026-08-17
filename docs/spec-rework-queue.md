# Spec-rework queue — consumer discovery integration

> Status: sanctioned 2026-08-17.
> Trigger: ADR-0018 (consumer discovery and principal).
> Rule: these are **not** ordinary documentation cleanups — each rework is
> a spec-rework loop (`/rework-spec`) that follows the pipeline process:
> the human proposes changes, the spec agent implements them, and review
> validates consistency with the constitution (blueprint, ADRs, other specs).

---

## Why a dedicated queue

ADR-0018 introduces a fifth principal mode (`consumer`) and restores
authenticated discovery as a V2 launch capability. This impacts multiple
frozen specs. Per the project rules, implementers may not silently edit
specs — spec changes go through the rework loop. This document records the
dependency-ordered sequence so rework agents know what to rework and in what
order.

---

## Dependency-ordered rework sequence

Each step depends on the previous step being complete and approved. Do not
start a step until its predecessor is approved.

### Step 1: `core` and `contract`

**Files:** `docs/specs/core.md`, `docs/specs/contract.md`

**Changes required:**

- Add `consumer` to the principal mode union (`staff | customer | public |
  system | consumer`).
- Define `ConsumerCtx` type: `{ db: ReadTx, userId, requestId,
  correlationId, channel, clientIp }` — no `companyId`.
- Contract check rules for `consumer` actions: `risk: read`,
  `permissions: []`, `audit: false`, `emits: []`, `transport: client`.
- Consumer rate-limiting contract (per-user, tighter than staff, looser
  than public).
- Consumer logging contract (request ID, actor user, channel; null
  company).
- Transport exposure: `consumer` actions are exposed on the client oRPC
  router.
- `ctx.call` rules: a `consumer` action cannot call a company-scoped
  action; it may call another `consumer`-principal read.
- Update the test-kit section: inherited consumer cross-tenant test cases
  (no unpublished access, no CRM side effects, no company data leakage).

---

### Step 2: `db`, `security-operations`, and `template`

**Files:** `docs/specs/db.md`, `docs/specs/security-operations.md`,
`docs/specs/template.md`

**Changes required:**

- `db`: global published-read access constraints — what indexes/projections
  support discovery without full-table scans; `business_categories` and
  `company_business_categories` table ownership (already in ADR-0018, needs
  schema reflection).
- `security-operations`: consumer principal in the data-classification and
  authorization matrix; rate-limiting tiers; logging classification.
- `template`: add `consumer` principal row to the action template; add
  required test cases for consumer actions (no resolveTarget, published-only
  access, no CRM creation, no audit, no events).

---

### Step 3: New full specs — `companies`, `catalog`, `search`

**Files:** new `docs/specs/companies.md`, new `docs/specs/catalog.md`,
new `docs/specs/search.md`

**Changes required:**

- `companies` (replaces `companies-foundation.md` minimal slice): full
  company CRUD, RBAC, legal info, public profile/showcase,
  **publication lifecycle** (draft → published → unpublished), business
  categories taxonomy, `consumer`-principal published-company reads.
- `catalog`: products, variants, categories, images, **active/published
  product lifecycle**, `consumer`-principal published-product reads,
  company-scoped staff reads.
- `search`: global FTS/trigram projections for published companies and
  active published products; `consumer`-principal discovery actions
  (text search, category filter, suggestions); explicitly does NOT own
  domain data or pricing; declares read-model grants from
  `companies`/`catalog`.

---

### Step 4: `customers` and `orders`

**Files:** `docs/specs/customers.md` (new), rework `docs/specs/orders.md`

**Changes required:**

- `customers`: staff-created customers; checkout-time atomic link/create
  (matching v1 `create_order_secure` phone/email logic); idempotency of
  CRM creation; multi-company customer support (one user, many CRM
  records); no discovery/chat/browse → CRM side effects.
- `orders`: update checkout action to perform atomic CRM link/create when
  the user is not yet a CRM customer of the company; reference
  `customers` spec for the exact creation contract.

---

### Step 5: Rework `pricing` and `chat`

**Files:** rework `docs/specs/pricing.md`, rework `docs/specs/chat.md`

**Changes required:**

- `pricing`: non-CRM users (consumers who discovered the company but have
  no CRM record yet) see **public/default prices only** — the resolution
  chain skips personal/group/customer-list levels for unknown customers;
  define the fallback behavior explicitly.
- `chat`: `openMyConversation` sets `company_customer_id` only when the
  CRM row already exists; otherwise `null`. Chat does not create CRM
  records. Company visibility uses the same publication rule
  (`companies.published`); a consumer cannot open a conversation with an
  unpublished company.

---

## Validation checklist (consistency review)

After all five steps are complete, verify across the full document set:

- [ ] Signed-in users can discover companies/products without an invite.
- [ ] One user may be a customer of many companies, with one company scope
  per customer action.
- [ ] Only published facts appear in discovery (consumer actions).
- [ ] Public direct links do not imply anonymous checkout.
- [ ] Search projections never own catalog/company/pricing state.
- [ ] Physical v1 marketplace views and social mechanics are not carried
  forward (no `consumer_products_view`, no follows/likes/feed/embeddings).
- [ ] No stale references to old phase numbers, `marketplace` hub, or
  invite-only entry.
- [ ] Principal enum in all specs matches `staff | customer | public |
  system | consumer`.
- [ ] The `consumer` principal is never used for write, audit, or event
  emission.

---

## Execution notes

- Each step is a separate `/rework-spec` invocation; the human initiates.
- Steps 3a–3c (companies, catalog, search) may partially parallelize once
  step 2 is approved, since they don't depend on each other (only on
  core/contract/db/template being stable).
- Steps 4 and 5 strictly depend on step 3.
- Existing specs not listed here (`money.md`, `feature-flags.md`,
  `payments.md`) are unaffected by ADR-0018.
