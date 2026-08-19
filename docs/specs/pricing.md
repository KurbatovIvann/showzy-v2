# Spec: pricing

> Status: Living.
> Active surface: none.
> Density beyond the declared slice is intent, not contract; do not treat unimplemented sections as frozen.
> Written against blueprint §2.1, §4, §5; scope §2, §8; ADR-0008, ADR-0013,
> ADR-0014, ADR-0015, ADR-0016; `docs/specs/core.md`, `docs/specs/db.md`,
> `docs/specs/money.md`, `docs/specs/contract.md`,
> `docs/specs/companies-foundation.md`.

## 1. Purpose

The `pricing` module is the single source of truth for resolved product/variant
prices. It owns price lists (named tiers with per-product and per-variant
entries), personal price overrides (per-customer per-product/variant), and the
5-level price resolution algorithm that produces the immutable price facts
consumed by orders and the storefront. It explicitly does NOT own: product base
prices or variant base prices (catalog), customer/group records or
customer-to-price-list assignments (customers), tax configuration (catalog or
future tax module), order/cart price snapshots (orders), or discount/promo
engines (future). Non-CRM users — authenticated users who discovered the
company but have no `company_customers` record (ADR-0018) — receive reduced
resolution: only levels 4 (default price list) and 5 (base price) participate;
levels 1–3 (personal, client price list, group price list) are skipped.
Consumer discovery search results do not include prices; prices are shown only
when the user enters company context (company profile / catalog page).

## 2. Owned tables

All tables in `packages/db/src/schema/pricing.ts` (ADR-0014).

### 2.1 `price_lists`

| Column | Type | Constraints / default | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `company_id` | `uuid NOT NULL` | FK → `companies.id` `ON DELETE CASCADE` | Tenant root |
| `name` | `text NOT NULL` | | Human-readable label |
| `code` | `text NOT NULL` | Unique `(company_id, code)` | Machine-stable identifier |
| `description` | `text` | Nullable | |
| `is_default` | `boolean` | Default `false` | At most one per company |
| `is_active` | `boolean` | Default `true` | Inactive lists skipped at every resolution level |
| `sort_order` | `integer` | Default `0` | UI display ordering |
| `created_at` | `timestamptz` | Default `now()` | |
| `updated_at` | `timestamptz` | Default `now()`, trigger-maintained | |

**Indexes:**

- Unique `(company_id, code)` — natural composite key.
- Partial unique `(company_id) WHERE is_default = true` — DB backstop for one
  default per company (the swap logic lives in the `setDefaultPriceList` action,
  not a trigger).
- `(company_id, is_active)` — resolution queries filter by tenant + active.

### 2.2 `price_list_entries`

Renamed from v1 `price_list_items` to avoid ambiguity with order line items.

| Column | Type | Constraints / default | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `company_id` | `uuid NOT NULL` | FK → `companies.id` `ON DELETE CASCADE` | Denormalized for tenant-scoped queries |
| `price_list_id` | `uuid NOT NULL` | FK → `price_lists.id` `ON DELETE CASCADE` | |
| `product_id` | `uuid NOT NULL` | FK → `products.id` `ON DELETE CASCADE` | Cross-module FK (catalog) |
| `variant_id` | `uuid` | Nullable; FK → `product_variants.id` `ON DELETE CASCADE` | Null = product-level entry |
| `price_minor` | `bigint NOT NULL` | CHECK `price_minor >= 0` | Minor units (kopiykas) |
| `currency` | `char(3) NOT NULL` | Default `'UAH'` | db.md §3 |
| `created_at` | `timestamptz` | Default `now()` | |
| `updated_at` | `timestamptz` | Default `now()`, trigger-maintained | |

**Indexes:**

- Unique `(price_list_id, product_id) WHERE variant_id IS NULL` — one
  product-level entry per list.
- Unique `(price_list_id, variant_id) WHERE variant_id IS NOT NULL` — one
  variant-level entry per list.
- `(company_id)` — tenant-scoped bulk operations.
- `(product_id)` — cascade/cleanup lookups.

### 2.3 `personal_prices`

Renamed from v1 `customer_product_prices` for clarity.

| Column | Type | Constraints / default | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `company_id` | `uuid NOT NULL` | FK → `companies.id` `ON DELETE CASCADE` | Denormalized for tenant-scoped queries |
| `customer_id` | `uuid NOT NULL` | FK → `company_customers.id` `ON DELETE CASCADE` | Cross-module FK (customers) |
| `product_id` | `uuid NOT NULL` | FK → `products.id` `ON DELETE CASCADE` | Cross-module FK (catalog) |
| `variant_id` | `uuid` | Nullable; FK → `product_variants.id` `ON DELETE CASCADE` | Null = product-level override |
| `price_minor` | `bigint NOT NULL` | CHECK `price_minor >= 0` | Minor units (kopiykas) |
| `currency` | `char(3) NOT NULL` | Default `'UAH'` | db.md §3 |
| `created_at` | `timestamptz` | Default `now()` | |
| `updated_at` | `timestamptz` | Default `now()`, trigger-maintained | |

**Indexes:**

- Unique `(customer_id, product_id) WHERE variant_id IS NULL` — one
  product-level personal price per customer.
- Unique `(customer_id, variant_id) WHERE variant_id IS NOT NULL` — one
  variant-level personal price per customer.
- `(company_id)` — tenant-scoped bulk operations.
- `(product_id)` — cascade/cleanup lookups.

### 2.4 Not owned (explicit boundary)

| Data | Owner | How pricing reads it |
| --- | --- | --- |
| Product base prices, variant base prices | `catalog` | `ctx.call` to catalog read actions |
| Customer CRM records, group membership, customer → `price_list_id`, group → `price_list_id` | `customers` | `ctx.call` to customers read actions |
| Order/cart price snapshots | `orders` | Orders calls pricing resolution; pricing never reads orders |
| Tax treatment/rate | `catalog` (product-level fact) | Not consumed by pricing; consumed by orders at snapshot time |

## 3. Actions

Shared output types referenced below:

```ts
const PriceList = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  name: z.string(),
  code: z.string(),
  description: z.string().nullable(),
  isDefault: z.boolean(),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const PriceListEntry = z.object({
  id: z.string().uuid(),
  priceListId: z.string().uuid(),
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable(),
  priceMinor: z.string(), // canonical decimal string (db.md §3)
  currency: z.string().length(3),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const PersonalPrice = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid(),
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable(),
  priceMinor: z.string(),
  currency: z.string().length(3),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const ResolvedPrice = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable(),
  unitPriceMinor: z.string(),           // canonical decimal string
  currency: z.string().length(3),
  source: z.enum([
    "personal",
    "customer_price_list",
    "group_price_list",
    "default_price_list",
    "base",
  ]),
  matchLevel: z.enum(["variant", "product"]),
  sourceIds: z.object({
    personalPriceId: z.string().uuid().optional(),
    priceListId: z.string().uuid().optional(),
    entryId: z.string().uuid().optional(),
  }),
  resolverVersion: z.number().int(),
});
```

---

### 3.1 `pricing.resolveProductPrices`

| Field | Value |
| --- | --- |
| Name | `pricing.resolveProductPrices` |
| Description | Resolve effective prices for one or more products/variants for a given customer of this company, using the full 5-level pricing hierarchy. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ items: z.array(z.object({ productId: z.string().uuid(), variantId: z.string().uuid().optional() })).min(1).max(200), customerId: z.string().uuid().optional() }` |
| Output | `{ prices: z.array(ResolvedPrice) }` |
| Permissions | `["pricing:view"]` |
| aiExposure | `exposed` |
| risk | `read` |
| requiresConfirmation | `false` |
| idempotent | `false` (reads are naturally idempotent) |
| emits | `[]` |
| audit | `false` |
| timeout | `3_000` |
| Calls (`ctx.call`) | `catalog.getProductPricingFacts`, `customers.getCustomerPricingFacts` |

### 3.2 `pricing.resolveMyProductPrices`

| Field | Value |
| --- | --- |
| Name | `pricing.resolveMyProductPrices` |
| Description | Resolve effective prices for products/variants from the perspective of the authenticated user. If the user has a CRM record (`company_customers` row) at this company, the full 5-level resolution chain applies. If not (non-CRM user per ADR-0018), resolution starts at level 4 (default price list) and falls back to level 5 (base price). Used by orders/cart and storefront catalog reads. |
| Principal | `customer` |
| Transport | `internal` |
| Target | Typed `resolveTarget` resolves the company from the first item's `productId` via catalog and verifies the company is accessible to the authenticated user (published, or user holds a CRM record). Looks up the user's CRM record for that company (via customers read); returns `{ companyId, resource: { customerId } }` where `customerId` is the CRM record ID if one exists, or `null` if the user has no CRM record at this company. When invoked via `ctx.call`, receives `inheritedCompanyId` and verifies consistency. |
| Input | `{ items: z.array(z.object({ productId: z.string().uuid(), variantId: z.string().uuid().optional() })).min(1).max(200) }` |
| Output | `{ prices: z.array(ResolvedPrice) }` |
| Permissions | `[]` |
| aiExposure | `internal` |
| risk | `read` |
| requiresConfirmation | `false` |
| idempotent | `false` |
| emits | `[]` |
| audit | `false` |
| timeout | `3_000` |
| Calls (`ctx.call`) | `catalog.getProductPricingFacts`, `customers.getCustomerPricingFactsForUser` (called only when `customerId` is non-null; skipped for non-CRM users — levels 1–3 are inapplicable without a CRM record) |

### 3.3 `pricing.resolvePublicProductPrices`

| Field | Value |
| --- | --- |
| Name | `pricing.resolvePublicProductPrices` |
| Description | Resolve product prices visible to an unauthenticated visitor: default price list and base price only (personal/customer/group levels are unavailable without identity). |
| Principal | `public` |
| Transport | `internal` |
| Target | Typed `resolveTarget` loads the company by slug/id and proves it is public; returns `{ companyId, resource: { companyId } }`. |
| Input | `{ companySlug: z.string(), items: z.array(z.object({ productId: z.string().uuid(), variantId: z.string().uuid().optional() })).min(1).max(200) }` |
| Output | `{ prices: z.array(ResolvedPrice) }` |
| Permissions | `[]` |
| aiExposure | `internal` |
| risk | `read` |
| requiresConfirmation | `false` |
| idempotent | `false` |
| emits | `[]` |
| audit | `false` |
| timeout | `3_000` |
| Calls (`ctx.call`) | `catalog.getProductPricingFacts` |

---

### 3.4 `pricing.createPriceList`

| Field | Value |
| --- | --- |
| Name | `pricing.createPriceList` |
| Description | Create a new price list for this company. If `isDefault` is true, the existing default is unset atomically. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ name: z.string().min(1).max(200), code: z.string().min(1).max(50).regex(/^[a-z0-9_-]+$/), description: z.string().max(1000).optional(), isDefault: z.boolean().optional().default(false), isActive: z.boolean().optional().default(true), sortOrder: z.number().int().optional().default(0) }` |
| Output | `PriceList` |
| Permissions | `["pricing:manage"]` |
| aiExposure | `exposed` |
| risk | `write` |
| requiresConfirmation | `false` |
| idempotent | `true` — key: client-supplied; scope: `company:<companyId>`; conflict: same key + different input → `IdempotencyConflictError` |
| emits | `[]` |
| audit | `true` |
| auditTarget | `{ type: "price_list", id: <created id> }` |
| timeout | `5_000` |

### 3.5 `pricing.updatePriceList`

| Field | Value |
| --- | --- |
| Name | `pricing.updatePriceList` |
| Description | Update a price list's name, code, description, active status, or sort order. To change the default, use `pricing.setDefaultPriceList`. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ priceListId: z.string().uuid(), name: z.string().min(1).max(200).optional(), code: z.string().min(1).max(50).regex(/^[a-z0-9_-]+$/).optional(), description: z.string().max(1000).nullable().optional(), isActive: z.boolean().optional(), sortOrder: z.number().int().optional() }` |
| Output | `PriceList` |
| Permissions | `["pricing:manage"]` |
| aiExposure | `exposed` |
| risk | `write` |
| requiresConfirmation | `false` |
| idempotent | `true` — key: client-supplied; scope: `company:<companyId>` |
| emits | `[]` |
| audit | `true` |
| auditTarget | `{ type: "price_list", id: input.priceListId }` |
| timeout | `5_000` |

### 3.6 `pricing.setDefaultPriceList`

| Field | Value |
| --- | --- |
| Name | `pricing.setDefaultPriceList` |
| Description | Designate a price list as the company default. The previously default list (if any) is unset atomically. The target list must be active. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ priceListId: z.string().uuid() }` |
| Output | `PriceList` |
| Permissions | `["pricing:manage"]` |
| aiExposure | `exposed` |
| risk | `write` |
| requiresConfirmation | `false` |
| idempotent | `true` — key: client-supplied; scope: `company:<companyId>` |
| emits | `[]` |
| audit | `true` |
| auditTarget | `{ type: "price_list", id: input.priceListId }` |
| timeout | `5_000` |

### 3.7 `pricing.deletePriceList`

| Field | Value |
| --- | --- |
| Name | `pricing.deletePriceList` |
| Description | Delete a price list and all its entries. This cannot be undone. Customers and groups assigned to this list will fall through to the next resolution level. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ priceListId: z.string().uuid() }` |
| Output | `{ deleted: z.literal(true) }` |
| Permissions | `["pricing:manage"]` |
| aiExposure | `exposed` |
| risk | `high` |
| requiresConfirmation | `true` |
| confirmationSummary | Returns price list name, code, number of entries, and number of customers/groups currently assigned to it (via `ctx.call` to customers reads). |
| idempotent | `true` — key: client-supplied; scope: `company:<companyId>`; replay if already deleted returns `{ deleted: true }` |
| emits | `[]` |
| audit | `true` |
| auditTarget | `{ type: "price_list", id: input.priceListId }` |
| timeout | `5_000` |
| Calls (`ctx.call`) | `customers.getCustomerPricingFacts` (in `confirmationSummary`: counts assigned customers/groups) |

---

### 3.8 `pricing.setPriceListEntries`

| Field | Value |
| --- | --- |
| Name | `pricing.setPriceListEntries` |
| Description | Bulk upsert price entries on a price list. Creates entries that do not exist and updates prices for those that do. Up to 200 entries per call. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ priceListId: z.string().uuid(), entries: z.array(z.object({ productId: z.string().uuid(), variantId: z.string().uuid().optional(), priceMinor: z.string() })).min(1).max(200) }` |
| Output | `{ upserted: z.number().int() }` |
| Permissions | `["pricing:manage"]` |
| aiExposure | `exposed` |
| risk | `write` |
| requiresConfirmation | `false` |
| idempotent | `true` — key: client-supplied; scope: `company:<companyId>` |
| emits | `[]` |
| audit | `true` |
| auditTarget | `{ type: "price_list", id: input.priceListId }` |
| timeout | `10_000` |

Handler acquires row locks in stable `(product_id, variant_id)` sort order to
prevent deadlocks under concurrent bulk updates to the same list.

### 3.9 `pricing.removePriceListEntries`

| Field | Value |
| --- | --- |
| Name | `pricing.removePriceListEntries` |
| Description | Remove specific product/variant entries from a price list. Missing entries are silently ignored. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ priceListId: z.string().uuid(), entries: z.array(z.object({ productId: z.string().uuid(), variantId: z.string().uuid().optional() })).min(1).max(200) }` |
| Output | `{ removed: z.number().int() }` |
| Permissions | `["pricing:manage"]` |
| aiExposure | `exposed` |
| risk | `write` |
| requiresConfirmation | `false` |
| idempotent | `true` — key: client-supplied; scope: `company:<companyId>` |
| emits | `[]` |
| audit | `true` |
| auditTarget | `{ type: "price_list", id: input.priceListId }` |
| timeout | `5_000` |

---

### 3.10 `pricing.setPersonalPrice`

| Field | Value |
| --- | --- |
| Name | `pricing.setPersonalPrice` |
| Description | Set (or update) a personal price override for a specific customer and product/variant. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ customerId: z.string().uuid(), productId: z.string().uuid(), variantId: z.string().uuid().optional(), priceMinor: z.string() }` |
| Output | `PersonalPrice` |
| Permissions | `["pricing:manage"]` |
| aiExposure | `exposed` |
| risk | `write` |
| requiresConfirmation | `false` |
| idempotent | `true` — key: client-supplied; scope: `company:<companyId>` |
| emits | `[]` |
| audit | `true` |
| auditTarget | `{ type: "personal_price", id: <upserted id> }` |
| timeout | `5_000` |

### 3.11 `pricing.removePersonalPrice`

| Field | Value |
| --- | --- |
| Name | `pricing.removePersonalPrice` |
| Description | Remove a personal price override for a customer and product/variant. Returns success even if the override did not exist. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ customerId: z.string().uuid(), productId: z.string().uuid(), variantId: z.string().uuid().optional() }` |
| Output | `{ removed: z.literal(true) }` |
| Permissions | `["pricing:manage"]` |
| aiExposure | `exposed` |
| risk | `write` |
| requiresConfirmation | `false` |
| idempotent | `true` — key: client-supplied; scope: `company:<companyId>` |
| emits | `[]` |
| audit | `true` |
| auditTarget | `{ type: "personal_price", id: "<customerId>:<productId>:<variantId>" }` |
| timeout | `5_000` |

---

### 3.12 `pricing.listPriceLists`

| Field | Value |
| --- | --- |
| Name | `pricing.listPriceLists` |
| Description | List all price lists for this company, ordered by sort order then name. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ includeInactive: z.boolean().optional().default(false) }` |
| Output | `{ priceLists: z.array(PriceList) }` |
| Permissions | `["pricing:view"]` |
| aiExposure | `exposed` |
| risk | `read` |
| requiresConfirmation | `false` |
| idempotent | `false` |
| emits | `[]` |
| audit | `false` |
| timeout | `2_000` |

### 3.13 `pricing.getPriceList`

| Field | Value |
| --- | --- |
| Name | `pricing.getPriceList` |
| Description | Get a single price list by ID, including metadata. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ priceListId: z.string().uuid() }` |
| Output | `PriceList` |
| Permissions | `["pricing:view"]` |
| aiExposure | `exposed` |
| risk | `read` |
| requiresConfirmation | `false` |
| idempotent | `false` |
| emits | `[]` |
| audit | `false` |
| timeout | `2_000` |

### 3.14 `pricing.listPriceListEntries`

| Field | Value |
| --- | --- |
| Name | `pricing.listPriceListEntries` |
| Description | List price entries for a given price list, with cursor-based pagination. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ priceListId: z.string().uuid(), cursor: z.string().uuid().optional(), limit: z.number().int().min(1).max(200).optional().default(50), productId: z.string().uuid().optional() }` |
| Output | `{ entries: z.array(PriceListEntry), nextCursor: z.string().uuid().nullable() }` |
| Permissions | `["pricing:view"]` |
| aiExposure | `exposed` |
| risk | `read` |
| requiresConfirmation | `false` |
| idempotent | `false` |
| emits | `[]` |
| audit | `false` |
| timeout | `3_000` |

### 3.15 `pricing.listPersonalPrices`

| Field | Value |
| --- | --- |
| Name | `pricing.listPersonalPrices` |
| Description | List personal price overrides, optionally filtered by customer or product. Cursor-paginated. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ customerId: z.string().uuid().optional(), productId: z.string().uuid().optional(), cursor: z.string().uuid().optional(), limit: z.number().int().min(1).max(200).optional().default(50) }` |
| Output | `{ personalPrices: z.array(PersonalPrice), nextCursor: z.string().uuid().nullable() }` |
| Permissions | `["pricing:view"]` |
| aiExposure | `exposed` |
| risk | `read` |
| requiresConfirmation | `false` |
| idempotent | `false` |
| emits | `[]` |
| audit | `false` |
| timeout | `3_000` |

## 4. Events

### 4.1 Emitted

None in V2 launch. Price changes are captured by the audit log on every write
action. Carts re-resolve prices at checkout time (the order snapshot is the
durable record, not a cached price). If a future consumer needs reactive
notification of price changes (e.g. a storefront cache invalidation), a
`pricing.priceListUpdated` event can be added without changing the action
surface.

### 4.2 Consumed

None. Pricing is a pure data-and-query module; it does not react to events
from other modules.

### 4.3 Read-model grants

None.

## 5. State machines and concurrency

### 5.1 Price list `is_default` invariant

At most one price list per company may be the default. The partial unique index
`(company_id) WHERE is_default = true` is the DB backstop.

The `setDefaultPriceList` action atomically:

1. Loads the target list with `FOR UPDATE` — verifies it belongs to the
   company, is active, and is not already the default.
2. If another list is currently the default, clears `is_default = false`
   on the old list within the same transaction.
3. Sets `is_default = true` on the target.

Concurrent `setDefaultPriceList` calls for the same company serialize on the
`FOR UPDATE` lock. If both try to set different lists, one wins and the other
retries or observes a completed idempotency result.

### 5.2 `is_active` and resolution

Deactivating a list (`updatePriceList` with `isActive: false`) does not remove
entries or customer/group assignments. The list simply stops participating in
price resolution. Reactivating it restores its effect immediately. A list
that is both `is_default = true` and `is_active = false` retains its default
flag but is skipped during resolution — the result is as if no default exists
(fallback to base price). This avoids surprising reassignment: the owner can
deactivate, test, and reactivate without losing the default designation.

### 5.3 Concurrent entry upserts

`setPriceListEntries` acquires row locks in deterministic
`(product_id, variant_id)` sort order to prevent deadlocks. Two concurrent
calls modifying the same entries on the same list serialize cleanly; different
entries proceed without contention.

### 5.4 Resolution chain and non-CRM fallback

The 5-level resolution chain, in strict priority order:

1. **Personal price** (level 1) — requires a CRM record + a `personal_prices`
   entry for the customer/product/variant.
2. **Client price list** (level 2) — requires a CRM record + the customer's
   assigned `price_list_id` pointing to an **active** price list with a
   matching entry.
3. **Group price list** (level 3) — requires a CRM record + group membership +
   the group's `price_list_id` pointing to an **active** price list with a
   matching entry.
4. **Default price list** (level 4) — the company's `is_default = true`
   **active** price list with a matching entry. No CRM record required.
5. **Base price** (level 5) — the product/variant base price from catalog.
   Always available. No CRM record required.

Resolution stops at the first level that produces a hit. Within each level,
a variant-specific entry takes priority over a product-level entry (§6.2).

**Non-CRM user fallback (ADR-0018):** When the caller has no
`company_customers` record at the target company, levels 1–3 are skipped
entirely — resolution begins at level 4 (default price list) and falls back
to level 5 (base price). This applies to:

- `pricing.resolveMyProductPrices` — authenticated user with no CRM record
  (target resolver returns `customerId: null`); the handler skips the
  `customers.getCustomerPricingFacts` call and resolves from default/base
  only.
- `pricing.resolveProductPrices` — staff action with `customerId` omitted.
- `pricing.resolvePublicProductPrices` — unauthenticated; always non-CRM.

This means a non-CRM authenticated user and a public (unauthenticated) visitor
see identical prices for the same product — both resolve from default price
list + base price. The difference is authentication and rate-limit tier, not
pricing.

**Consumer discovery surface:** The `search` module's consumer-principal
actions (ADR-0018) do **not** call pricing resolution and do **not** return
price data. Prices are shown only when the user enters company context
(company profile / catalog page), at which point the appropriate resolution
action (`resolveMyProductPrices` for authenticated, `resolvePublicProductPrices`
for unauthenticated) is invoked.

### 5.5 Checkout racing a price change

Pricing is resolved within the order-creation transaction via `ctx.call`. The
snapshot captured at that moment is immutable (money.md). A price change that
commits after the resolution but before the order commits does not affect the
order — the resolver runs in the caller's read-consistent transaction.

## 6. Edge cases

1. **No CRM record for the caller.** If `customerId` is null or omitted,
   resolution skips levels 1–3 (personal, client price list, group price
   list) and starts at level 4 (default price list), falling back to level 5
   (base price). This applies to three distinct caller categories:
   - **Staff panel** (`resolveProductPrices` with `customerId` omitted): a
     staff member resolving prices without specifying a customer sees
     default/base prices (useful for catalog management preview).
   - **Authenticated non-CRM user** (`resolveMyProductPrices` with
     `customerId: null` from the target resolver): a user who discovered the
     company via search or direct link but has not yet placed an order or
     been manually added as a CRM customer. They see the same prices as a
     public visitor. (ADR-0018)
   - **Public visitor** (`resolvePublicProductPrices`): unauthenticated
     access to a published company's catalog.
   (v1 `resolve_product_price` handled the no-customer case with
   `p_customer_id IS NULL` guards; v2 generalizes this to the non-CRM
   authenticated user path introduced by ADR-0018. See §5.4 for the full
   resolution chain description.)

2. **Variant entry vs. product entry precedence.** Within each hierarchy level,
   a variant-specific entry takes priority over the product-level entry. If a
   variant entry exists at level 2 (customer list) but not level 1 (personal),
   and a product entry exists at level 1, the personal product entry (level 1)
   still wins — level priority is absolute. v1 had no variants in pricing; this
   is new behavior.

3. **Variant belonging to another product.** If `variantId` does not belong to
   `productId` according to catalog facts, the resolver treats it as if the
   variant does not exist (returns `NotFoundError`). No cross-product price
   leaks.

4. **Zero prices.** `price_minor = 0` is valid (free items in promotional
   lists). The CHECK constraint enforces `>= 0`.

5. **Deleting the default price list.** After deletion, the company has no
   default list. Resolution falls through to base price. The confirmation
   summary warns the staff member about the number of affected
   customers/groups.

6. **Deactivating the only/default price list.** Allowed. Resolution falls
   through to base price. No automatic reassignment.

7. **Concurrent `setDefaultPriceList` calls.** The `FOR UPDATE` lock serializes
   them. The partial unique index is the backstop. One call succeeds; if both
   use idempotency keys, the second replays the winner or receives a conflict.

8. **Cross-company product/customer IDs.** The resolver loads customer/product
   facts via `ctx.call` to catalog/customers read actions, which verify
   tenant scope. A product ID belonging to company B passed to a staff context
   of company A results in `NotFoundError` — no existence leak (ADR-0013).

9. **Price list code collisions.** The unique `(company_id, code)` constraint
   surfaces a `ConflictError` on `createPriceList` or `updatePriceList`.

10. **Deleting a product or variant.** The `ON DELETE CASCADE` on
    `price_list_entries` and `personal_prices` FKs automatically removes
    associated price data when catalog deletes a product/variant.

11. **Deleting a customer.** The `ON DELETE CASCADE` on `personal_prices.customer_id`
    removes personal prices when customers deletes a CRM record.

12. **Inactive list assigned to customer/group.** v1 only checked `is_active`
    on the default list — a bug that let inactive assigned lists still resolve.
    v2 skips inactive lists at every level: personal (not list-based — always
    checked), customer list (skipped if inactive), group list (skipped if
    inactive), default list (skipped if inactive).

13. **Batch resolve with an unresolvable item.** If any item in the `items`
    array references a product/variant that does not exist or belongs to
    another company, the entire call fails with `NotFoundError` — no partial
    results. This is consistent with the no-leak rules (§6.3, §6.8): a caller
    cannot distinguish "does not exist" from "belongs to another tenant."

## 7. v1 migration notes

### 7.1 Tables

#### `price_lists` → `price_lists` (TRANSFORM)

Source migration: `20260301000008_customers_and_pricing.sql`, Part 1.

| v1 column | v2 column | Transform |
| --- | --- | --- |
| `id uuid` | `id uuid` | Direct copy |
| `company_id uuid` | `company_id uuid` | Direct copy |
| `name text` | `name text` | Direct copy |
| `code text` | `code text` | Direct copy |
| `description text` | `description text` | Direct copy |
| `is_default boolean` | `is_default boolean` | Direct copy |
| `is_active boolean` | `is_active boolean` | Direct copy |
| `sort_order integer` | `sort_order integer` | Direct copy |
| `created_at timestamptz` | `created_at timestamptz` | Direct copy |
| `updated_at timestamptz` | `updated_at timestamptz` | Direct copy |

No column additions or removals. Schema is structurally identical.

**Cleanup:** verify every company has at most one `is_default = true` row
(the partial unique index enforces this post-migration).

**Reconciliation query:**
```sql
SELECT count(*) AS total,
       count(*) FILTER (WHERE is_default) AS defaults
FROM price_lists
GROUP BY company_id
HAVING count(*) FILTER (WHERE is_default) > 1;
-- Must return 0 rows.
```

#### `price_list_items` → `price_list_entries` (TRANSFORM)

Source migration: `20260301000008_customers_and_pricing.sql`, Part 4.

| v1 column | v2 column | Transform |
| --- | --- | --- |
| `id uuid` | `id uuid` | Direct copy |
| `company_id uuid` | `company_id uuid` | Direct copy |
| `price_list_id uuid` | `price_list_id uuid` | Direct copy |
| `product_id uuid` | `product_id uuid` | Direct copy |
| — | `variant_id uuid` | Set to `NULL` for all migrated rows (v1 has no variant pricing) |
| `price numeric(10,2)` | `price_minor bigint` | `ROUND(price * 100)::bigint`; assert no sub-kopiykas: `price * 100 = ROUND(price * 100)` |
| — | `currency char(3)` | Set to `'UAH'` for all migrated rows |
| `created_at timestamptz` | `created_at timestamptz` | Direct copy |
| `updated_at timestamptz` | `updated_at timestamptz` | Direct copy |

**Cleanup:** remove any entries referencing deleted products
(`product_id NOT IN (SELECT id FROM products)`) — should not exist due to FK
cascade but verify.

**Reconciliation query:**
```sql
SELECT count(*) AS v1_count FROM price_list_items;
SELECT count(*) AS v2_count FROM price_list_entries;
-- v2_count must equal v1_count.

SELECT v1.id
FROM price_list_items v1
JOIN price_list_entries v2 ON v2.id = v1.id
WHERE v2.price_minor != ROUND(v1.price * 100)::bigint;
-- Must return 0 rows.
```

#### `customer_product_prices` → `personal_prices` (TRANSFORM)

Source migration: `20260301000008_customers_and_pricing.sql`, Part 5.

| v1 column | v2 column | Transform |
| --- | --- | --- |
| `id uuid` | `id uuid` | Direct copy |
| `company_id uuid` | `company_id uuid` | Direct copy |
| `customer_id uuid` | `customer_id uuid` | Direct copy |
| `product_id uuid` | `product_id uuid` | Direct copy |
| — | `variant_id uuid` | Set to `NULL` for all migrated rows |
| `price numeric(10,2)` | `price_minor bigint` | `ROUND(price * 100)::bigint`; same sub-kopiykas assertion |
| — | `currency char(3)` | Set to `'UAH'` for all migrated rows |
| `created_at timestamptz` | `created_at timestamptz` | Direct copy |
| `updated_at timestamptz` | `updated_at timestamptz` | Direct copy |

**Cleanup:** remove orphan rows where `customer_id` no longer exists in
`company_customers`.

**Reconciliation query:**
```sql
SELECT count(*) AS v1_count FROM customer_product_prices;
SELECT count(*) AS v2_count FROM personal_prices;
-- v2_count must equal v1_count (minus orphans removed in cleanup).

SELECT sum(ROUND(price * 100)::bigint) AS v1_total FROM customer_product_prices;
SELECT sum(price_minor) AS v2_total FROM personal_prices;
-- Must match (modulo cleaned-up orphans).
```

### 7.2 Functions and RPCs

| v1 object | Decision | v2 location |
| --- | --- | --- |
| `resolve_product_price(...)` | TRANSFORM | `pricing` module resolution service (pure function, no SQL RPC). Behavior preserved 1:1 for the 5 hierarchy levels; extended with variant awareness and inactive-list skipping. |
| `resolve_product_prices_batch(...)` | TRANSFORM | Same resolution service; the batch optimization is the default path (single query with `LEFT JOIN` per level, not N calls). |
| `ensure_single_default_price_list()` trigger function | MOVE to action | `pricing.setDefaultPriceList` action atomically swaps the default; the partial unique index remains as a DB backstop. |
| `refresh_cart_prices(...)` | MOVE to orders | Replaced by `orders` calling `pricing.resolveMyProductPrices` via `ctx.call` at checkout time. |

### 7.3 Triggers

| v1 trigger | Decision | v2 location |
| --- | --- | --- |
| `set_price_lists_updated_at` | KEEP | Shared `updated_at` trigger (db.md §5) |
| `ensure_single_default_price_list_trigger` | MOVE | `pricing.setDefaultPriceList` action + partial unique index |
| `set_price_list_items_updated_at` | KEEP | Shared `updated_at` trigger |
| `set_customer_product_prices_updated_at` | KEEP | Shared `updated_at` trigger |

### 7.4 RLS policies

All v1 RLS policies are DROP. The operation each policy authorized is mapped to
a v2 action or resolver:

| v1 policy | v2 replacement |
| --- | --- |
| `price_lists: anon read defaults` | `pricing.resolvePublicProductPrices` target resolver (verifies company is public) |
| `price_lists: authenticated read` (inc. 0331 fix for group lists) | Staff: `pricing:view` permission. Customer: `pricing.resolveMyProductPrices` target resolver loads the customer's own assigned/group lists via `ctx.call`. |
| `price_lists: member insert/update/delete` | `pricing:manage` permission on `createPriceList`/`updatePriceList`/`deletePriceList` |
| `price_list_items: member and public read` (inc. 0331 fix) | Same as `price_lists` read — resolved through the hierarchy in the resolver |
| `price_list_items: member insert/update/delete` | `pricing:manage` permission on `setPriceListEntries`/`removePriceListEntries` |
| `customer_product_prices: member and self read` | Staff: `pricing:view` on `listPersonalPrices`. Customer self-read: embedded in `pricing.resolveMyProductPrices` (customer sees their own resolved price, not the raw personal-price table). |
| `customer_product_prices: member insert/update/delete` | `pricing:manage` permission on `setPersonalPrice`/`removePersonalPrice` |
| `customer_groups: customer self read` (0331 addition) | Customer's group membership is loaded by `customers.getCustomerPricingFacts` within the resolver transaction; no direct group table access by pricing. |

### 7.5 Cutover order

1. Migrate `price_lists` (no column changes except indexes).
2. Migrate `price_list_items` → `price_list_entries` (rename, add
   `variant_id NULL`, convert `numeric → bigint`, add `currency`).
3. Migrate `customer_product_prices` → `personal_prices` (same transforms).
4. Run reconciliation queries; assert row counts and price totals match.
5. No v1 data is destroyed during migration (the v1 repo is read-only).

### 7.6 Rollback

Restore from the pre-migration backup (db.md §6: forward-only migrations,
restore + roll forward). The v1 tables are not modified; the v2 tables can be
dropped and the migration re-run after fixes.

## 8. Non-functional requirements

- **Batch resolution performance.** `resolveProductPrices` / batch variants
  must resolve up to 200 items in a single transaction without N+1 queries.
  The implementation uses one query per hierarchy level (4 `LEFT JOIN`s on the
  denormalized `company_id` + `product_id`/`variant_id`, same strategy as v1's
  `resolve_product_prices_batch`), plus one `ctx.call` for customer facts and
  one for product facts.
- **No PII in audit.** Price values are not PII, but customer identifiers in
  `setPersonalPrice` audit rows use the default hash-only policy (core.md §8).
  No `auditSnapshot` opt-in.
- **Expected volumes.** Typical company: 1–5 price lists, 50–500 products,
  5–50 entries per list, 0–100 personal prices. Resolution called on every
  catalog page load and checkout. Rate limits: default per principal (core.md
  §10).

## 9. Acceptance criteria

Mandatory minimum (inherited from template):

- [ ] Cross-tenant isolation: staff of company A cannot read/write price
      lists of company B; customer of company A cannot resolve prices for
      company B's products; public resolver only works for public companies.
- [ ] Authorization denial: staff without `pricing:view` cannot resolve or
      list; staff without `pricing:manage` cannot create/update/delete lists
      or set personal prices.
- [ ] Validation failure surfaces typed `ValidationError` for invalid input
      (negative prices, empty entries array, malformed code, etc.).
- [ ] Runtime output validation: every action output passes its Zod schema
      before commit; money values are canonical decimal strings on the wire,
      not JSON numbers.
- [ ] Idempotency: replay of `createPriceList` with the same key returns the
      same result without re-running the handler; same key with different input
      returns `IdempotencyConflictError`.
- [ ] Audit records written for all write/high-risk actions.

Module-specific:

- [ ] **Resolution level precedence (golden tests).** For each level
      (personal → customer list → group list → default list → base), verify
      that a hit at level N prevents fallthrough to level N+1, and that a miss
      at level N correctly falls through.
- [ ] **Variant vs. product match level.** Within a single hierarchy level,
      a variant-specific entry beats a product-level entry. If neither exists
      at that level, the resolver falls through to the next level.
- [ ] **Inactive list skipping.** An inactive customer/group/default list is
      skipped; resolution falls through to the next level. Covers the v1 bug
      fix (inactive assigned lists were not skipped).
- [ ] **Snapshot determinism.** Equivalent inputs produce byte-identical
      `ResolvedPrice` output regardless of invocation channel (ui/ai/system)
      — per money.md acceptance criteria.
- [ ] **`resolverVersion` monotonicity.** The version is a compile-time
      constant (`RESOLVER_VERSION = 1` at launch) in the pricing resolver
      service, bumped on every resolution-semantics change; every snapshot
      records it.
- [ ] **Default swap atomicity.** Two concurrent `setDefaultPriceList` calls
      for different lists result in exactly one default, never zero or two.
- [ ] **Bulk entry deadlock freedom.** Two concurrent `setPriceListEntries`
      calls on the same list with overlapping products complete without
      deadlock (stable lock ordering).
- [ ] **Confirmation on delete.** `deletePriceList` requires confirmation and
      the summary accurately reports entry count and customer/group assignment
      count.
- [ ] **Cross-module `ctx.call` targets are `risk: read`.** Resolution actions
      only call catalog/customers read actions; CI contract check enforces this.
- [ ] **Cascade cleanup.** Deleting a product/variant in catalog cascades and
      removes associated `price_list_entries` and `personal_prices` rows.
- [ ] **Public resolution.** Unauthenticated resolution returns only
      default-list and base prices; personal/customer/group levels are never
      accessible.
- [ ] **Non-CRM user resolution (ADR-0018).** An authenticated user with no
      `company_customers` record at the target company resolves prices from
      default price list and base price only; levels 1–3 (personal,
      customer-list, group-list) are unreachable. Verified via
      `resolveMyProductPrices` with a user who has no CRM record — the
      target resolver returns `customerId: null` and the handler skips
      `customers.getCustomerPricingFacts`.
- [ ] **Non-CRM / public price equivalence.** For the same product, a
      non-CRM authenticated user (`resolveMyProductPrices`) and an
      unauthenticated visitor (`resolvePublicProductPrices`) receive
      identical `ResolvedPrice` output (same `unitPriceMinor`, `source`,
      `matchLevel`).
- [ ] **Consumer discovery shows no prices.** The pricing module exposes no
      `consumer`-principal actions. Prices are absent from discovery search
      results (verified in the `search` module spec; pricing tests confirm
      no consumer-principal actions are registered).

## 10. Resolved decisions

1. **Variant-aware pricing** — entries carry optional `variant_id`; within
   each hierarchy level, variant entry beats product entry; fallback chain
   includes variant base price then product base price (owner, 2026-08-17).
2. **Tax outside pricing** — resolution returns price facts only; tax
   treatment/rate is a catalog product-level fact consumed by orders/documents
   (owner, 2026-08-17).
3. **Inactive lists skipped at every level** — v1 only checked `is_active` on
   the default list; v2 treats this as a bug and skips inactive lists
   uniformly (owner, 2026-08-17).
4. **No domain events in V2 launch** — price changes are captured by audit;
   carts re-resolve at checkout; reactive notifications (cache invalidation)
   can be added later without changing the action surface (owner, 2026-08-17).

## 11. Composition contract (required callee capabilities)

For ADR-0015 reviewability, the following `ctx.call` targets must be provided
by their owning modules. These are listed here as spec requirements; the
owning specs define the exact shapes.

| Callee | Action (expected) | Principal modes | What pricing needs |
| --- | --- | --- | --- |
| `catalog` | `catalog.getProductPricingFacts` | `staff`, `customer`, `public` | Product ID → `{ productId, companyId, basePriceMinor, currency, variants: [{ variantId, basePriceMinor }] }` (or subset per principal). Verifies product exists and belongs to the resolved company. |
| `customers` | `customers.getCustomerPricingFacts` (staff), `customers.getCustomerPricingFactsForUser` (customer) | `staff`, `customer` | Customer ID → `{ customerId, companyId, priceListId, groupId, groupPriceListId }`. Verifies the customer belongs to the resolved company. **Conditionally called:** when `resolveMyProductPrices` resolves `customerId: null` (non-CRM user, ADR-0018), this action is not invoked — pricing skips levels 1–3 and resolves from default price list and base price only. |

The catalog and customers specs must expose these as `risk: read`,
principal-compatible actions per ADR-0015. If these actions do not exist when
the pricing module is implemented, the pricing spec is blocked and must report
the gap.

## Changelog

| Date | Change | Why | Reported by |
| --- | --- | --- | --- |
| 2026-08-17 | Initial draft | Pricing module specification | spec agent |
| 2026-08-17 | Non-CRM user resolution fallback | ADR-0018 Step 5: explicit fallback for authenticated users without a CRM record; resolution skips levels 1–3, starts at default price list; consumer discovery shows no prices; `resolveMyProductPrices` target resolver returns nullable `customerId` | spec-rework agent |
