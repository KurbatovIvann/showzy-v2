# Spec: orders (phase-1 reference slice)

> Status: Approved (frozen). Approved by: owner, 2026-08-17.
> Written against blueprint §2.1, §4, §7.1; scope §1.1, §3, §7 (phase 1);
> ADR-0008, ADR-0011, ADR-0012, ADR-0013, ADR-0014, ADR-0015, ADR-0016,
> ADR-0018;
> `docs/specs/core.md`, `docs/specs/db.md`, `docs/specs/money.md`,
> `docs/specs/contract.md`, `docs/specs/payments.md`, `docs/specs/pricing.md`,
> `docs/specs/companies-foundation.md`; `docs/module-ownership.md`.
>
> **Scope note (owner directive, 2026-08-17): phase 1 implements only the
> thin order → transactional outbox → chat projection reference slice.**
> This spec covers exactly that slice. Full orders functionality (carts,
> customer checkout, delivery, numbering, cancel/edit, order log,
> `company_statuses`, chat collaboration) belongs to phases 4–6 and reaches
> this file only through `/rework-spec` with owner approval. The slice
> schema is designed so those phases extend it additively — no renames, no
> column-type changes.

## 1. Purpose

The `orders` module is the source of truth for order domain state: orders,
their immutable money snapshots, and the fixed order lifecycle. It emits
lifecycle events; projections (chat, notifications, dashboards) subscribe
and store `orderId`, never order state (ADR-0011 — `orders` does not know
chat exists). It explicitly does NOT own: payment records/status
(`payments`), shipment state (`delivery`), conversations or order cards
(`chat`), product/pricing/customer master data (`catalog`/`pricing`/
`customers`).

### 1.1 Slice boundary

The phase-1 slice is the write/idempotency/event reference template
(blueprint §7.1 stage 3b) that every later module copies. It contains:

- tables `orders` + `order_items` (minimal columns, full money.md snapshot
  shape);
- actions `orders.create` (staff), `orders.confirm` (staff), `orders.get`
  (staff);
- events `orders.created`, `orders.confirmed`;
- the canonical `ctx.call` composition: orders → pricing/catalog/customers
  reads inside the order-creation transaction (ADR-0015).

Explicitly deferred (target phase in parentheses): `carts`/`cart_items` and
customer checkout incl. `orders.checkout` with atomic CRM link/create
(ADR-0018) and customer reads
`orders.getMine`/`orders.listMine` (4) · delivery selection and
`order_deliveries` consumption (4) · order numbering
(`order_number`, per-company prefix + sequence service in code) (4) ·
counterparty/contact snapshot columns (4) · `company_statuses` seeding and
display-status layer (4) · payment/delivery auto-transitions from consumed
events (4) · `orders.cancel` (4) · `order_logs` activity trail (4) · order
editing `orders.updateItems` with versioned adjustment snapshots
(6, money.md) · chat collaboration actions and redirect-to-chat (6).

## 2. Owned tables

Both tables live in `packages/db/src/schema/orders.ts` (ADR-0014).
Deferred tables (`carts`, `cart_items`, `order_logs`, `company_statuses`)
are NOT created in phase 1.

### 2.1 `orders`

| Column | Type | Constraints / default | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `company_id` | `uuid NOT NULL` | FK → `companies.id` `ON DELETE CASCADE` | Tenant root |
| `customer_id` | `uuid` | Nullable; FK → `company_customers.id` `ON DELETE SET NULL` | Nullable for v1 legacy rows and CRM-record deletion (v1 behavior); `orders.create` always sets it. Phase 4 adds counterparty snapshot columns |
| `status` | `text NOT NULL` | Default `'new'`, CHECK `status IN ('new','confirmed','canceled')` | Fixed lifecycle (scope §3); allowed transitions in §5. `canceled` is declared for forward-compat; no slice action produces it |
| `comment` | `text` | Nullable | Free-text note captured at creation |
| `total_net_minor` | `bigint NOT NULL` | CHECK `>= 0` | Sum of line `net_amount_minor` (money.md: totals are sums of persisted lines) |
| `total_tax_minor` | `bigint NOT NULL` | CHECK `>= 0` | Sum of line `tax_amount_minor` |
| `total_gross_minor` | `bigint NOT NULL` | CHECK `>= 0` | Sum of line `gross_amount_minor` |
| `currency` | `char(3) NOT NULL` | Default `'UAH'` | db.md §3 |
| `confirmed_at` | `timestamptz` | Nullable | Set by the `orders.confirm` handler, never by trigger |
| `created_at` | `timestamptz` | Default `now()` | |
| `updated_at` | `timestamptz` | Default `now()`, trigger-maintained | |

**Indexes:**

- `(company_id, created_at DESC)` — panel order list (phase 2+ UI, cheap now).
- `(company_id, status)` — status filtering.
- `(customer_id)` — customer-side lookups (phase-4 `getMine` resolver).

### 2.2 `order_items`

Immutable money snapshot rows (money.md). No `updated_at`: a snapshot row is
never updated after insert; phase-6 editing appends versioned adjustment
rows per money.md, it does not mutate these.

| Column | Type | Constraints / default | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `company_id` | `uuid NOT NULL` | FK → `companies.id` `ON DELETE CASCADE` | Denormalized for tenant-scoped queries |
| `order_id` | `uuid NOT NULL` | FK → `orders.id` `ON DELETE CASCADE` | |
| `product_id` | `uuid NOT NULL` | FK → `products.id` `ON DELETE RESTRICT` | Changed from v1 `CASCADE`: deleting a product must not delete financial history. Catalog must archive/soft-delete ordered products (flagged to catalog spec, §10) |
| `variant_id` | `uuid` | Nullable; FK → `product_variants.id` `ON DELETE RESTRICT` | Null = product without variant selection |
| `title_snapshot` | `text NOT NULL` | | Product (+ variant) display name at order time; order display survives catalog renames/deletes |
| `quantity_milli` | `bigint NOT NULL` | CHECK `> 0` | Fixed-scale quantity, scale 3 (money.md): `1000` = 1 unit |
| `unit_price_minor` | `bigint NOT NULL` | CHECK `>= 0` | Resolved unit price snapshot |
| `discount_kind` | `text NOT NULL` | Default `'none'`, CHECK `IN ('none')` | Slice: no discounts. Phase 4+ extends CHECK additively (`percent`, `amount`) |
| `discount_value` | `bigint NOT NULL` | Default `0` | Kind-dependent raw value (money.md) |
| `discount_amount_minor` | `bigint NOT NULL` | Default `0`, CHECK `>= 0` | |
| `tax_treatment` | `text NOT NULL` | CHECK `IN ('exempt','inclusive','exclusive')` | Slice always snapshots `'exempt'` (money.md default); full tax facts arrive with catalog (phase 2/4) |
| `tax_rate_bp` | `integer NOT NULL` | Default `0`, CHECK `>= 0` | Basis points (`2000` = 20%) |
| `tax_amount_minor` | `bigint NOT NULL` | Default `0`, CHECK `>= 0` | |
| `net_amount_minor` | `bigint NOT NULL` | CHECK `>= 0` | Rounded line net (money.md rounding) |
| `gross_amount_minor` | `bigint NOT NULL` | CHECK `>= 0` | Rounded line gross |
| `currency` | `char(3) NOT NULL` | Default `'UAH'` | |
| `price_source` | `text` | Nullable, CHECK `IN ('personal','customer_price_list','group_price_list','default_price_list','base')` | From `ResolvedPrice.source` (pricing spec). Null only for migrated v1 rows |
| `personal_price_id` | `uuid` | Nullable, **no FK** | Historical reference from `ResolvedPrice.sourceIds`; deliberately not a FK — snapshots must not change when pricing rows are deleted |
| `price_list_id` | `uuid` | Nullable, **no FK** | Same |
| `price_list_entry_id` | `uuid` | Nullable, **no FK** | Same |
| `resolver_version` | `integer NOT NULL` | | `ResolvedPrice.resolverVersion`; `0` is the sentinel for migrated v1 rows |
| `created_at` | `timestamptz` | Default `now()` | |

**Indexes:**

- `(order_id)` — line loading.
- `(company_id)` — tenant-scoped operations.
- `(product_id)` — RESTRICT-delete lookups and reporting.

## 3. Actions

Shared output shapes (wire types per contract.md — money and quantity as
canonical decimal strings):

```ts
const OrderItem = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable(),
  titleSnapshot: z.string(),
  quantityMilli: z.string(),
  unitPriceMinor: z.string(),
  discountKind: z.enum(["none"]),
  discountValue: z.string(),
  discountAmountMinor: z.string(),
  taxTreatment: z.enum(["exempt", "inclusive", "exclusive"]),
  taxRateBp: z.number().int(),
  taxAmountMinor: z.string(),
  netAmountMinor: z.string(),
  grossAmountMinor: z.string(),
  currency: z.string().length(3),
  priceSource: z.enum([
    "personal",
    "customer_price_list",
    "group_price_list",
    "default_price_list",
    "base",
  ]),
  priceSourceIds: z.object({
    personalPriceId: z.string().uuid().optional(),
    priceListId: z.string().uuid().optional(),
    entryId: z.string().uuid().optional(),
  }),
  resolverVersion: z.number().int(),
  createdAt: z.string().datetime(),
});

const Order = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  customerId: z.string().uuid().nullable(),
  status: z.enum(["new", "confirmed", "canceled"]),
  comment: z.string().nullable(),
  totalNetMinor: z.string(),
  totalTaxMinor: z.string(),
  totalGrossMinor: z.string(),
  currency: z.string().length(3),
  confirmedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  items: z.array(OrderItem),
});
```

### 3.1 `orders.create`

| Field | Value |
| --- | --- |
| Name | `orders.create` |
| Description | Create an order for an existing customer of this company. The customer must have a linked Showzy account (no account-less orders). Prices are resolved through the 5-level pricing hierarchy at this moment and stored as immutable snapshots; later price changes never affect this order. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ customerId: z.string().uuid(), items: z.array(z.object({ productId: z.string().uuid(), variantId: z.string().uuid().optional(), quantityMilli: z.string().regex(/^[1-9][0-9]{0,11}$/) })).min(1).max(100), comment: z.string().max(2000).optional() }` |
| Output | `Order` |
| Permissions | `["orders:create"]` |
| aiExposure | `exposed` |
| risk | `write` |
| requiresConfirmation | `false` |
| Idempotent | `true` — key: client-supplied (`createMutationAttempt()`, contract.md §3); scope: `company:<companyId>`; conflict: same key + different input → `IdempotencyConflictError`; replay returns the stored order without a second insert or duplicate events |
| Emits | `["orders.created"]` |
| Audit | `true` |
| auditTarget | `{ type: "order", id: <created order id> }` (hash-only input, no snapshot — contact data must not enter audit) |
| Timeout | `10_000` |
| Calls (`ctx.call`) | `customers.getCustomerOrderFacts` (verify customer belongs to this company; obtain `userId` for the event payload), `catalog.getProductFacts` (existence, active flag, names, variant ownership, tax facts), `pricing.resolveProductPrices` (staff read; resolved price facts per item) |

Handler outline (the reference template): validate item uniqueness → load
customer/product facts and resolved prices via `ctx.call` (same transaction,
read-consistent — pricing spec §5.4) → compute line snapshots with the
shared money service (money.md; slice: `discount_kind='none'`,
`tax_treatment='exempt'`) → insert `orders` + `order_items` → `ctx.emit`
`orders.created` → output. All inside the single core pipeline transaction.

### 3.2 `orders.confirm`

| Field | Value |
| --- | --- |
| Name | `orders.confirm` |
| Description | Confirm a new order on behalf of the company. Only orders in status "new" can be confirmed. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ orderId: z.string().uuid() }` |
| Output | `Order` |
| Permissions | `["orders:edit"]` |
| aiExposure | `exposed` |
| risk | `write` |
| requiresConfirmation | `false` |
| Idempotent | `true` — key: client-supplied; scope: `company:<companyId>`; replay returns the stored confirmed order |
| Emits | `["orders.confirmed"]` |
| Audit | `true` |
| auditTarget | `{ type: "order", id: input.orderId }` |
| Timeout | `5_000` |
| Calls (`ctx.call`) | none |

Handler: `SELECT ... FOR UPDATE` on the order (tenant-scoped) → transition
check (§5) → set `status='confirmed'`, `confirmed_at=now-in-handler` →
`ctx.emit` `orders.confirmed`.

### 3.3 `orders.get`

| Field | Value |
| --- | --- |
| Name | `orders.get` |
| Description | Get a single order of this company by ID, including its line items and money snapshots. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ orderId: z.string().uuid() }` |
| Output | `Order` |
| Permissions | `["orders:view"]` |
| aiExposure | `exposed` |
| risk | `read` |
| requiresConfirmation | `false` |
| Idempotent | `false` (reads are naturally idempotent) |
| Emits | `[]` |
| Audit | `false` |
| Timeout | `2_000` |

This is also the read that chat/AI clients use to render an order card from
a stored `orderId` (ADR-0011: the projection stores the ID; the client
fetches authoritative state through this action). The phase-4 customer
counterpart (`orders.getMine` with a typed ownership resolver) shares the
same module service.

### 3.4 Phase-4 `orders.checkout` — CRM atomic link/create (forward declaration)

The phase-4 `orders.checkout` action (customer principal) converts a cart
into an order on behalf of the authenticated user. Per ADR-0018, checkout
is the **only** point in the consumer-to-customer journey where a CRM
`company_customers` record must exist.

**Cart interaction does NOT require a CRM record.** A user may discover a
company (consumer principal), browse their catalog, and add items to a
cart without any CRM record in that company.

**Atomic CRM link/create rule:** When `orders.checkout` executes, it must
atomically ensure a `company_customers` record exists for the authenticated
user in the target company:

1. If the user already has a CRM record in this company → use it.
2. If the user does not have a CRM record → create one atomically within
   the checkout transaction, via `ctx.call` to the customers module's
   idempotent link/create action (matching v1 `create_order_secure`
   phone/email-first logic; exact contract in `docs/specs/customers.md`).

The resolved `customerId` is then used for the order's `customer_id` column,
event payloads, and downstream composition (pricing resolution, etc.).

This replaces the v1 `create_order_secure` logic where the RPC function
resolved the counterparty by phone/email and created a CRM row inline.
In v2, that responsibility is delegated to the `customers` module — `orders`
calls it via `ctx.call`, keeping CRM ownership with `customers` (ADR-0015).

`orders.create` (staff, this slice) is unaffected: it requires an existing
customer and rejects CRM-less lookups with `NotFoundError` (§6 case 1).

The full `orders.checkout` action spec (input, output, permissions, events,
edge cases) will be defined in the phase-4 `/rework-spec` of this file.

## 4. Events

### 4.1 Emitted

Both events: envelope version `1`, `scope: "tenant"`, aggregate
`{ type: "order", id: orderId }` with the core per-aggregate monotonic
sequence (core.md §6). Payloads are JSON-safe; money as decimal strings.

**`orders.created`** — payload:

```ts
{
  orderId: z.string().uuid(),
  customerId: z.string().uuid(),
  customerUserId: z.string().uuid(), // guaranteed: orders require a linked account (§10.8)
  totalGrossMinor: z.string(),
  currency: z.string().length(3),
  itemCount: z.number().int().min(1),
}
```

Expected subscribers: `chat` (order-card projection — consumer
`chat.order-card-updater`, `docs/specs/chat.md` §2.7 / §3.3), `payments`
(`payments.createForOrder`, keyed by this event's ID — payments spec §5),
later `notifications` (phase 4 push) and `analytics`.

**`orders.confirmed`** — payload:

```ts
{
  orderId: z.string().uuid(),
  customerId: z.string().uuid().nullable(),   // null only if the CRM record was
  customerUserId: z.string().uuid().nullable(), // deleted between create and confirm
  confirmedAt: z.string().datetime(),
}
```

Expected subscribers: `chat` (card update — the canonical ADR-0011 path,
same consumer), later `notifications`.

### 4.2 Consumed

None in the phase-1 slice. Phase 4 adds consumption of
`payments.statusChanged` and delivery status events for the fixed
auto-transitions (scope §3), each bound to an internal idempotent
tenant-scoped system action per core.md §6.

### 4.3 Read-model grants

None.

## 5. State machines and concurrency

### 5.1 `orders.status` (fixed lifecycle)

| From | To | Trigger |
| --- | --- | --- |
| `new` | `confirmed` | `orders.confirm` (staff), phase-1 slice |
| `new` | `canceled` | reserved — phase-4 `orders.cancel` (no slice action) |
| `confirmed` | `canceled` | reserved — phase 4/6 |

Any other transition is `ConflictError`. Phase 4 extends the value set
additively (e.g. fulfillment states) via CHECK-constraint migration and
`/rework-spec`; `company_statuses` (deferred) becomes a display/workflow
layer on top of this fixed lifecycle and never replaces it as domain truth.

### 5.2 Concurrency

- **Concurrent confirms of one order** serialize on `SELECT ... FOR UPDATE`;
  the loser observes `status != 'new'` and receives `ConflictError` (or, if
  it retried with the winner's idempotency key, the stored replay).
- **Create racing a price change**: prices are resolved via `ctx.call`
  inside the creation transaction; the committed snapshot is whatever the
  resolver saw (pricing spec §5.4). No re-resolution ever occurs.
- **Retry racing success**: the core idempotency protocol (core.md §5)
  guarantees exactly one order row and exactly one `orders.created` event
  per logical submit.
- **Transaction boundary**: order insert, item inserts, outbox rows, audit
  row, and idempotency finalize commit atomically in the core pipeline
  transaction; any failure rolls all of them back.

## 6. Edge cases

1. **Customer of another company / unknown customer.**
   `customers.getCustomerOrderFacts` resolves within the caller's verified
   tenant scope → `NotFoundError`, no existence leak (ADR-0013). Same for
   products via `catalog.getProductFacts`.
2. **Inactive product.** `orders.create` rejects with `ConflictError`
   (v1 `create_order_secure` error `PRODUCT_INACTIVE`).
3. **Variant not belonging to the product.** Treated as nonexistent →
   `NotFoundError` (consistent with pricing spec edge case 3).
4. **Duplicate `(productId, variantId)` pairs in input.** `ValidationError`.
   The slice does not merge lines (v1 cart merged; carts arrive in phase 4).
5. **Customer without a linked user account.** `orders.create` rejects with
   `ConflictError`: orders require an account (owner decision, §10.8 —
   consistent with the scope §1.1 no-anonymous-orders rule). This keeps
   `orders.created.customerUserId` non-null and satisfies the frozen
   `payments.createForOrder` contract without rework.
6. **Zero/fractional-forbidden quantity.** Input regex rejects `0` and
   non-integers; DB CHECK `quantity_milli > 0` is the backstop. Per-product
   quantity increments (money.md) are enforced from phase 4 when catalog
   facts carry increments; the slice accepts any positive integer.
7. **Confirm of an already confirmed/canceled order.** New idempotency key →
   `ConflictError`; same key → stored replay (no second event).
8. **Rounding integrity.** Line snapshots come from the shared money
   service; order totals are sums of persisted lines, never recomputed
   independently (money.md). With slice defaults (`exempt`, no discount):
   `net = gross = unit_price_minor × quantity` rounded per money.md,
   `tax = 0`.
9. **Deleting a product that has order lines.** Blocked by
   `ON DELETE RESTRICT`; catalog must archive instead (§10). Order display
   uses `title_snapshot` regardless of catalog state.
10. **CRM record deleted after order creation.** `customer_id` becomes null
    (SET NULL, v1 behavior); the order, its snapshots, and emitted events
    are unaffected. Phase 4 adds counterparty snapshot columns so contact
    data survives too.
11. **Redelivery of `orders.created`/`orders.confirmed`.** Consumer dedup is
    the consumer's obligation via `event_deliveries` (core.md §6); orders
    guarantees per-aggregate ordering (created always sequence-precedes
    confirmed for one order).
12. **Checkout without existing CRM record (phase 4).** `orders.checkout`
    atomically creates a `company_customers` record via `ctx.call` to the
    customers module's idempotent link/create action before inserting the
    order. The CRM creation and order insertion share the same core pipeline
    transaction. If the user already has a CRM record, it is reused
    (idempotent). Matches v1 `create_order_secure` behavior (ADR-0018).
13. **Cart without CRM record.** A user may add items to a cart (phase 4)
    without having a CRM record in the company. The cart is not gated on CRM
    existence (ADR-0018). CRM is required only at checkout time (§3.4).
14. **Concurrent checkouts creating the same CRM record.** Two simultaneous
    `orders.checkout` calls by the same user for the same company: the
    customers module's link/create action is idempotent, so both calls
    succeed — the second finds the record created by the first (or the
    serialized transaction retries and finds it). No duplicate CRM records.

## 7. v1 migration notes

This slice creates the v2 `orders`/`order_items` tables, so their
column-level mapping is fixed now. Columns deferred to phase 4 (marked
below) are additive; their mapping is completed by the phase-4
`/rework-spec` before the launch data migration runs. Deferred tables
(`carts`, `cart_items`, `order_logs`, `company_statuses`) stay `TRANSFORM`
in the matrix with mapping owed by phase 4.

### 7.1 `orders` → `orders` (TRANSFORM)

Source migrations: `20260301000012_orders.sql` (+ `20260320000009`
counterparty, `20260320000013` contact check, `20260402000006` source).

| v1 column | v2 column | Transform |
| --- | --- | --- |
| `id` | `id` | Direct copy |
| `company_id` | `company_id` | Direct copy |
| `customer_id` | `customer_id` | Direct copy (nullable preserved) |
| `total_price numeric(10,2)` | `total_gross_minor bigint` | `ROUND(total_price * 100)::bigint`; assert no sub-kopiykas |
| — | `total_net_minor`, `total_tax_minor` | Recomputed from migrated lines: v1 has no tax/discount → `net = gross`, `tax = 0` |
| `status_id → company_statuses` | `status text` | Mapped via `company_statuses.code` → fixed-lifecycle mapping table defined in the phase-4 rework (before launch migration) |
| `payment_status`, `payment_method` | — | TRANSFORM to `payments` records (payments spec + phase-4 mapping); not order columns in v2 |
| `idempotency_key` | — | DROP — replaced by the core idempotency protocol (`idempotency_keys`, core.md §5) |
| `comment` | `comment` | Direct copy |
| `notes` | — | Phase-4 decision (merge into `comment` or a separate column) |
| `customer_name/email/phone` | — | Phase-4 counterparty snapshot columns |
| `delivery_address/city/postal_code` | — | TRANSFORM to `delivery` (`order_deliveries`) |
| `tracking_token` | — | **Proposed DROP** (§10): v2 has no anonymous orders; customers read own orders via typed resolvers |
| `order_number` | — | Phase-4 column; direct copy then |
| `counterparty_id`, `source` (later v1 additions) | — | Phase-4 mapping with counterparty/checkout design |
| `created_at`, `updated_at` | same | Direct copy |

**Reconciliation:** row count equality; per-company sum of
`ROUND(total_price*100)` equals sum of `total_gross_minor`. Orders whose v1
`total_price` disagrees with the sum of their v1 items (possible after v1
manual edits) are reported for manual review, not silently fixed.

### 7.2 `order_items` → `order_items` (TRANSFORM)

Source migration: `20260301000012_orders.sql` Part 4.

| v1 column | v2 column | Transform |
| --- | --- | --- |
| `id`, `company_id`, `order_id` | same | Direct copy |
| `product_id` | `product_id` | Direct copy; FK behavior `CASCADE` → `RESTRICT` |
| — | `variant_id` | `NULL` (v1 had no variants in orders) |
| — | `title_snapshot` | `products.name` at migration time; literal `'[deleted product]'` if unresolvable |
| `quantity integer` | `quantity_milli bigint` | `quantity * 1000` |
| `price numeric(10,2)` | `unit_price_minor bigint` | `ROUND(price * 100)::bigint`; assert no sub-kopiykas |
| — | `discount_kind/value/amount_minor` | `'none'` / `0` / `0` |
| — | `tax_treatment/rate_bp/amount_minor` | `'exempt'` / `0` / `0` |
| — | `net_amount_minor`, `gross_amount_minor` | `unit_price_minor * quantity` (integer, exact) |
| — | `currency` | `'UAH'` |
| — | `price_source`, source id columns | `NULL` (v1 did not persist resolution source) |
| — | `resolver_version` | `0` (legacy sentinel) |
| `created_at` | `created_at` | Direct copy |
| `updated_at` | — | DROP — v2 snapshot rows are immutable |

**Reconciliation:** row counts match; per-order
`sum(gross_amount_minor) = ROUND(v1 items price*quantity * 100)` totals
match; company-wide money totals match.

### 7.3 Functions and RPCs

| v1 object | Decision | v2 location |
| --- | --- | --- |
| `create_company_order` | TRANSFORM | `orders.create` (this slice) |
| `create_order_secure` | TRANSFORM (phase 4) | `orders.checkout` (customer principal, cart-based) with atomic CRM link/create delegated to the customers module via `ctx.call` (ADR-0018; replaces v1's inline phone/email-first counterparty resolution). The money/snapshot/idempotency machinery it needs ships in this slice |
| `update_order_items_secure` | TRANSFORM (phase 6) | Order editing with versioned adjustments (money.md) |
| `get_order_by_tracking_token` | Proposed DROP (§10) | Account-only reads via typed resolvers |
| `generate_order_number`, `set_order_number` | MOVE (phase 4) | Numbering service in code (db.md §5); no DB sequence trigger in v2 |
| `validate_order_status_transition` | MOVE | §5 transition check in `orders.confirm` (and later actions) |
| `auto_transition_on_payment_change`, `auto_transition_on_delivery_change` | MOVE (phase 4) | Event subscriptions → internal system actions (§4.2) |
| `validate_cart_company`, `update_cart_items_bulk`, `refresh_cart_prices`, `carts_view` | TRANSFORM (phase 4) | Cart actions; `refresh_cart_prices` is replaced by checkout-time `ctx.call` to pricing |
| `fn_orders_resolve_counterparty`, `trg_orders_resolve_counterparty` | TRANSFORM (phase 4) | Counterparty snapshot at creation, in the handler |
| `order_log_action` enum | TRANSFORM (phase 4) | text + CHECK on `order_logs` |

### 7.4 Triggers (source `20260301000012_orders.sql`)

| v1 trigger | Decision |
| --- | --- |
| `orders_update_timestamp` | KEEP — shared `updated_at` trigger (db.md §5) |
| `assign_order_number` | MOVE — phase-4 numbering service in code |
| `order_items_update_timestamp` | DROP — v2 `order_items` has no `updated_at` (immutable snapshots) |
| Realtime config (`replica identity full`, `supabase_realtime` publication) | DROP — realtime is Socket.IO fed by domain events |

### 7.5 RLS policies

All DROP; operations map to:

| v1 policy | v2 replacement |
| --- | --- |
| `orders: member and customer select` | Staff: `orders:view` on `orders.get` (+ phase-2+ list). Customer: phase-4 `orders.getMine`/`listMine` typed ownership resolver |
| `orders: member update` | `orders:edit` on `orders.confirm` (slice) and phase-4/6 edit/cancel actions |
| `orders: member delete` | No v2 hard-delete action; phase-4 decision (expected: cancel only) |
| `order_items: select / member insert/update/delete` | Items are written only inside `orders.create` (and phase-6 editing); read through `orders.get`. No direct item mutations exist in v2 |
| `order_logs: select` | Phase 4 with `order_logs` |

### 7.6 Matrix `REVIEW` rows assigned to this spec

Proposed resolutions requiring owner approval (§10); they concern phase-4
checkout and do not block this slice's schema task (its source rows —
`orders`, `order_items` — are `TRANSFORM`):

- **`checkout_sessions` → DROP.** It persisted checkout-form recovery state
  for a 24 h window (`20260301000013_payments.sql`). In v2, checkout is
  account-only, the cart itself is server-persisted (phase 4), and prefill
  comes from preferences; a second server-side draft of checkout state
  violates "one source of truth" for no recovery value on mobile.
- **`user_checkout_preferences` → TRANSFORM (phase 4).** Last-used
  delivery/payment prefill is real UX value for repeat orders. Carried as a
  user-scoped preferences table; owning module (orders vs delivery) is
  fixed in the phase-4 checkout design.

### 7.7 Cutover and rollback

1. Launch migration order: `orders` (after companies/customers), then
   `order_items` (after catalog), then reconciliation queries (§7.1–7.2).
2. Status mapping table (`company_statuses.code` → lifecycle value) is
   applied as part of the phase-4-completed mapping; launch migration runs
   against the final schema, not the slice schema.
3. Rollback: restore from pre-migration backup (db.md §6, forward-only);
   v1 (`E:\showzy`) is never modified.

## 8. Non-functional requirements

- `orders.create` resolves up to 100 items in one transaction with no N+1:
  one `ctx.call` each to customers, catalog, and pricing (pricing batches
  internally — pricing spec §8).
- PII: order rows in this slice contain no contact data. Event payloads
  carry IDs and money totals only. Audit is hash-only (no `auditSnapshot`).
  `comment` may contain free text — it never enters events, audit, or logs.
- Expected volume is low (single-digit orders/day per company at launch);
  no special rate limits beyond core defaults (core.md §10).

## 9. Acceptance criteria

Mandatory minimum:

- [ ] Cross-tenant isolation: staff of company A cannot create/confirm/read
      orders involving company B's customers, products, or orders (all
      failures are `NotFoundError`/`PermissionDeniedError` without
      existence leaks), via the inherited `crossTenantSuite`.
- [ ] Authorization denial: missing `orders:create`/`orders:edit`/
      `orders:view` → `PermissionDeniedError`; denials on audited actions
      are audit-logged (core.md §8).
- [ ] Validation failure surfaces typed `ValidationError` (empty items,
      duplicate lines, zero/negative/fractional quantity, >100 items,
      missing idempotency key).
- [ ] Output validates at runtime and is JSON-safe; all money/quantity
      values are canonical decimal strings on the wire.
- [ ] Idempotency (`idempotencySuite`): replay returns the stored order
      without re-running the handler; same key + different payload →
      `IdempotencyConflictError`; concurrent double-submit creates exactly
      one order.
- [ ] Declared events are emitted transactionally (`eventSuite`): a failed
      handler leaves no order, items, events, or audit rows.
- [ ] Audit records written for `orders.create` and `orders.confirm` with
      `auditTarget` = order.

Module-specific (the reference-template guarantees):

- [ ] **Snapshot immutability.** After `orders.create`, changing price list
      entries/personal prices/product base price and re-reading the order
      yields byte-identical items and totals; a fresh resolution for the
      same items yields the new price (proves the snapshot, not a cache).
- [ ] **Money integrity.** For every created order,
      `total_net + total_tax = total_gross` and each total equals the sum
      of its persisted lines exactly (money.md); golden vectors cover the
      slice path (exempt tax, no discount, fractional quantity).
- [ ] **Snapshot provenance.** Every item records `price_source`, source
      IDs matching pricing's `ResolvedPrice.sourceIds`, and the current
      `resolverVersion`.
- [ ] **Channel determinism.** Equivalent `orders.create` inputs via
      ui/ai/system channels produce byte-identical snapshots (money.md).
- [ ] **Lifecycle.** `orders.confirm` on `new` sets `confirmed_at`, emits
      exactly one `orders.confirmed`; on `confirmed`/`canceled` with a new
      key → `ConflictError` and no event.
- [ ] **Event ordering.** For one order, `orders.created` and
      `orders.confirmed` carry strictly increasing aggregate sequences;
      a redelivered event is a consumer no-op (consumer-side test via
      `eventSuite` with the chat slice consumer).
- [ ] **`ctx.call` discipline.** All three composition targets are
      `risk: read`, staff-compatible; the contract check enforces it; the
      pricing call observes the creation transaction's read consistency.
- [ ] **Payload contract.** `orders.created` payload satisfies
      `payments.createForOrder` input needs (order ID, non-null user ID,
      gross total, currency) — verified by a cross-spec contract test.
- [ ] **Account requirement.** `orders.create` for a CRM customer without
      a linked account → `ConflictError`, no order, no events (§10.8).

## 10. Resolved decisions and open items

Resolved (owner, 2026-08-17):

1. **Spec scope** — this file covers only the phase-1 slice; phases 4–6
   extend it via `/rework-spec` (structure mirrors
   `companies-foundation.md`).
2. **Slice write action is staff-mode `orders.create`** (blueprint §4
   example; v1 `create_company_order`). Customer checkout is phase 4.
3. **Fixed lifecycle as `status text` + CHECK**; `company_statuses`
   deferred to phase 4 as a display/workflow layer that maps onto the
   fixed lifecycle — a mutable table never becomes the domain truth
   (refines the scope §8 note that `orders` owns `company_statuses`).
4. **`order_items.product_id ON DELETE RESTRICT` + `title_snapshot`** —
   catalog must archive/soft-delete products that have orders; the future
   catalog spec must carry a matching note.
5. **Matrix REVIEW resolutions** (§7.6): `checkout_sessions` → DROP;
   `user_checkout_preferences` → TRANSFORM in phase 4.
6. **`tracking_token` → DROP** (account-only orders; typed resolvers
   replace token reads).
7. **Companion slice spec** — the chat side of the slice is specified in
   `docs/specs/chat.md` (consumer `chat.order-card-updater`; table
   `order_cards`). Pointer updated 2026-08-17 when `chat-projection.md`
   was absorbed into the chat module spec; behavior unchanged.
8. **Orders require a linked account** (owner, 2026-08-17): no account-less
   orders are supported at this time. `orders.create` rejects a CRM
   customer without a linked `userId` (`ConflictError`, edge case 5), so
   `orders.created.customerUserId` is non-null and the frozen
   `payments.createForOrder` input contract is satisfied without a
   payments `/rework-spec`.
9. **Atomic CRM link/create at checkout** (ADR-0018, 2026-08-17): the
   phase-4 `orders.checkout` action atomically ensures a
   `company_customers` record exists for the authenticated user before
   creating the order (matching v1 `create_order_secure` behavior).
   Cart interaction does NOT require a CRM record — the user may browse
   and fill a cart as a consumer or existing customer without CRM
   consequences. CRM creation is delegated to the customers module via
   `ctx.call`; the exact contract (idempotent phone/email matching) is
   defined in `docs/specs/customers.md`. `orders.create` (staff, this
   slice) is unaffected — it requires an existing customer (§6 case 1).

## 11. Composition contract (required callee capabilities)

Per ADR-0015, these `ctx.call` targets must exist (principal-compatible,
`risk: read`) when the relevant action is implemented; gaps block the
action and must be reported. The first three targets are required for the
phase-1 slice (`orders.create`, staff); the fourth is required for the
phase-4 checkout (`orders.checkout`, customer):

| Callee | Action (expected) | What orders needs |
| --- | --- | --- |
| `customers` | `customers.getCustomerOrderFacts` | Customer ID → `{ customerId, companyId, userId \| null, displayName }`; verifies the customer belongs to the caller's company. Orders rejects `userId: null` with `ConflictError` (§10.8) |
| `catalog` | `catalog.getProductFacts` | Product IDs → `{ productId, companyId, name, isActive, taxTreatment, taxRateBp, variants: [{ variantId, name, isActive }] }`; slice may default tax facts to `exempt`/`0` until catalog carries tax configuration |
| `pricing` | `pricing.resolveProductPrices` | Already specified (pricing spec §3.1) |
| `customers` | `customers.ensureCustomerForCheckout` (or equivalent idempotent link/create; exact name in `docs/specs/customers.md`) | User ID + company ID → `{ customerId, companyId, userId, displayName }`; idempotently finds or creates a `company_customers` record for the authenticated user in the target company (phone/email matching per customers spec; ADR-0018). Called by the phase-4 `orders.checkout` only — not by the phase-1 `orders.create` (which requires an existing customer via `customers.getCustomerOrderFacts`) |

Consumers this module's events must satisfy: `payments.createForOrder`
(payments spec §4–5, keyed by `orders.created` event ID) and the chat
order-card consumer (`docs/specs/chat.md`, `chat.order-card-updater`).

## Changelog

| Date | Change | Why | Reported by |
| --- | --- | --- | --- |
| 2026-08-17 | Atomic CRM link/create for phase-4 checkout: §1.1 deferred-item update, §3.4 forward declaration, §6 edge cases 12–14, §7.3 `create_order_secure` mapping, §10.9, §11 composition contract | ADR-0018 consumer discovery spec-rework Step 4 | spec-rework agent |
| 2026-08-17 | Pointer-only: chat companion path `chat-projection.md` → `chat.md` (slice absorbed; consumer/table names unchanged) | One spec per chat module | owner |
| 2026-08-17 | Approved. Decision 8: orders require a linked account; `customerUserId` non-null in `orders.created`; payments cross-spec item closed | Owner approval | owner |
| 2026-08-17 | Owner resolved decisions 1–7 (§10): staff-mode slice write, text lifecycle, RESTRICT + title snapshot, REVIEW-row resolutions, tracking_token drop, chat companion spec | Draft review Q&A | owner |
| 2026-08-17 | Initial draft, scoped to the phase-1 reference slice per owner directive | Orders reference-slice specification | spec agent |
