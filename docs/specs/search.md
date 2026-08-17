# Spec: search

> Status: Draft. Pending: human review + `catalog` spec (product publication
> events and read-model grants).
> Written against blueprint §2.1, §5, §7; scope §3, §6, §7;
> ADR-0013, ADR-0014, ADR-0015, ADR-0018;
> module-ownership.md; spec-rework-queue Step 3c.

## 1. Purpose

The `search` module owns **global FTS/trigram discovery projections** of
published companies and active published products. It provides
`consumer`-principal actions for text search, category-filtered browsing, and
search suggestions — the primary authenticated discovery surface described in
ADR-0018 (phase 4).

It explicitly does **not** own: company or product domain data (`companies`,
`catalog`), pricing (`pricing`), CRM customer records (`customers`), business
categories taxonomy (`companies`), file/attachment metadata (`files`), or any
social/follower/embedding data (dropped — ADR-0018). Search is a
**projection**, never the source of truth for company or product data
(blueprint §2.1, invariant 5). It never emits domain events.

## 2. Owned tables

All tables live in `packages/db/src/schema/search.ts` (ADR-0014). These are
projection tables maintained by event-driven refresh — they contain
denormalized copies of published facts, never authoritative domain state.

### 2.1 `search_companies`

Denormalized projection of published companies for FTS/trigram discovery.

| Column | Type | Constraints / default | Notes |
| --- | --- | --- | --- |
| `company_id` | `uuid` | PK | Source: `companies.id` |
| `name` | `text` | NOT NULL | Company display name |
| `slug` | `text` | NOT NULL | URL identifier |
| `bio` | `text` | nullable | Short description |
| `city` | `text` | nullable | City name |
| `area` | `text` | nullable | Oblast/region |
| `logo_file_id` | `uuid` | nullable | Logo reference (display only, no FK) |
| `categories` | `jsonb` | NOT NULL, default `'[]'` | `[{ slug, nameUk }]` — denormalized for result rendering |
| `category_slugs` | `text[]` | NOT NULL, default `'{}'` | Flat slug array for efficient `@>` / `&&` filtering |
| `search_vector` | `tsvector` | NOT NULL | Generated from `name`, `bio`, city, area via `simple` config + `unaccent` |
| `name_normalized` | `text` | NOT NULL | `unaccent(lower(name))` — trigram source |
| `published_at` | `timestamptz` | NOT NULL | From `companies.published_at` |
| `refreshed_at` | `timestamptz` | NOT NULL, default `now()` | Last projection refresh |

**Indexes:**
- PK on `company_id`
- GIN on `search_vector` — full-text search
- GIN `gin_trgm_ops` on `name_normalized` — trigram similarity
- GIN on `category_slugs` — category filter
- `(published_at DESC, company_id)` — default sort / cursor pagination

**Not stored (v1 columns dropped):**
- `latitude`, `longitude` — geo-radius dropped (ADR-0018)
- `embedding` — vector search dropped
- `products_count`, `followers_count`, `orders_count` — social counters dropped
- `fts` (on companies table directly) — FTS authority moved here
- `keywords` — dropped

### 2.2 `search_products`

Denormalized projection of active published products for FTS/trigram
discovery. A product appears here only if its owning company is also
published.

| Column | Type | Constraints / default | Notes |
| --- | --- | --- | --- |
| `product_id` | `uuid` | PK | Source: `products.id` (catalog) |
| `company_id` | `uuid` | NOT NULL | Source: `products.company_id` |
| `company_name` | `text` | NOT NULL | Denormalized for result display |
| `company_slug` | `text` | NOT NULL | For linking to company profile |
| `name` | `text` | NOT NULL | Product name |
| `category_name` | `text` | nullable | Product category name (catalog-owned taxonomy) |
| `primary_image_file_id` | `uuid` | nullable | Primary product image (display only, no FK) |
| `search_vector` | `tsvector` | NOT NULL | Generated from product `name`, `category_name` via `simple` + `unaccent` |
| `name_normalized` | `text` | NOT NULL | `unaccent(lower(name))` — trigram source |
| `has_variants` | `boolean` | NOT NULL, default `false` | Whether the product has active variants |
| `refreshed_at` | `timestamptz` | NOT NULL, default `now()` | Last projection refresh |

**Indexes:**
- PK on `product_id`
- GIN on `search_vector` — full-text search
- GIN `gin_trgm_ops` on `name_normalized` — trigram similarity
- `(company_id)` — company-scoped product removal on unpublish
- `(company_id, product_id)` — efficient join for company+product results

**Not stored (deliberate omissions):**
- `price`, `base_price` — no pricing in discovery results (ADR-0018; price
  resolution is per-user at the company level)
- `likes_count`, `comments_count` — social dropped
- `embedding` — vector dropped
- `description` — not needed for search matching or result cards at launch;
  can be added in a future revision if needed

### 2.3 DB extensions required

- `pg_trgm` — trigram similarity (`similarity()`, GIN `gin_trgm_ops`)
- `unaccent` — accent-insensitive text normalization

Both are already retained from v1 (blueprint §3; migration matrix).

## 3. Actions

### 3.1 Consumer discovery

---

#### `search.discover`

| Field | Value |
| --- | --- |
| Name | `search.discover` |
| Description | Search for published companies and products by text query. Returns a mixed list of company and product matches ranked by relevance. If no query is provided, returns recently published companies. |
| Principal | `consumer` |
| Transport | `client` |
| Input | `{ query: z.string().max(200).optional(), categorySlug: z.string().optional(), cursor: z.string().optional(), limit: z.number().int().min(1).max(50).default(20) }` |
| Output | `{ companies: z.array(SearchCompanyCard), products: z.array(SearchProductCard), nextCursor: z.string().nullable() }` |
| Permissions | `[]` |
| aiExposure | `exposed` |
| risk | `read` |
| requiresConfirmation | `false` |
| Idempotent | `false` |
| Emits | `[]` |
| Audit | `false` |
| Timeout | `3000` |

```ts
const SearchCompanyCard = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  bio: z.string().nullable(),
  city: z.string().nullable(),
  area: z.string().nullable(),
  logoFileId: z.string().uuid().nullable(),
  categories: z.array(z.object({
    slug: z.string(),
    nameUk: z.string(),
  })),
  score: z.number(),
});

const SearchProductCard = z.object({
  id: z.string().uuid(),
  name: z.string(),
  companyId: z.string().uuid(),
  companyName: z.string(),
  companySlug: z.string(),
  categoryName: z.string().nullable(),
  primaryImageFileId: z.string().uuid().nullable(),
  hasVariants: z.boolean(),
  score: z.number(),
});
```

**Handler logic:**
1. If `query` is provided and `length(trim(query)) >= 2`:
   - Parse `plainto_tsquery('simple', unaccent(query))`.
   - Search `search_companies`: FTS match (`search_vector @@ tsquery`) OR
     trigram similarity (`similarity(name_normalized, unaccent(lower(query))) > 0.15`).
   - Search `search_products`: same FTS + trigram logic.
   - Rank companies by `ts_rank_cd(search_vector, tsquery) * 2.0 + similarity(name_normalized, ...) DESC`.
   - Rank products by the same formula.
   - If `categorySlug` is provided, additionally filter companies by
     `categorySlug = ANY(category_slugs)`.
2. If `query` is absent or shorter than 2 characters:
   - Return published companies ordered by `published_at DESC` (browse mode).
   - If `categorySlug` is provided, filter by category.
   - Products are omitted in browse-only mode (no query = no product ranking
     signal).
3. Apply cursor-based pagination on `(sort_value, company_id)` for companies
   and `(sort_value, product_id)` for products. The cursor encodes both
   positions. Limit applies to the total result count (companies + products
   combined).
4. Return `nextCursor: null` when fewer than `limit` results are returned.

**v1 mapping:** This action replaces the company-matching and
category-filtering logic of `search_browse`. Dropped from `search_browse`:
`p_embedding` (vector), `p_user_lat`/`p_user_lng`/`p_radius_km` (geo),
`p_city`/`p_area` (text location filter — retained only as displayed
projection fields, not filter dimensions at launch), `p_sort` modes
`popular`/`nearest` (social/geo), `top_products` with inline resolved prices
(pricing not in discovery), `followers_count`/`orders_count` (social
counters).

---

#### `search.suggest`

| Field | Value |
| --- | --- |
| Name | `search.suggest` |
| Description | Return fast autocomplete suggestions for a search query — a mixed list of matching company and product names. |
| Principal | `consumer` |
| Transport | `client` |
| Input | `{ query: z.string().min(2).max(200) }` |
| Output | `{ suggestions: z.array(SearchSuggestion) }` |
| Permissions | `[]` |
| aiExposure | `exposed` |
| risk | `read` |
| requiresConfirmation | `false` |
| Idempotent | `false` |
| Emits | `[]` |
| Audit | `false` |
| Timeout | `1500` |

```ts
const SearchSuggestion = z.object({
  type: z.enum(["company", "product"]),
  id: z.string().uuid(),
  name: z.string(),
  subtitle: z.string().nullable(),
  imageFileId: z.string().uuid().nullable(),
});
```

**Handler logic:**
1. Minimum 2-character query enforced by input validation.
2. Search `search_companies` (FTS + trigram, limit `ceil(limit/2)`):
   - `subtitle` = `city + ', ' + area` (same as v1).
   - `imageFileId` = `logo_file_id`.
3. Search `search_products` (FTS + trigram, limit `floor(limit/2)`):
   - `subtitle` = `company_name`.
   - `imageFileId` = `primary_image_file_id`.
4. Return combined results ordered by score descending, capped at 10 total.
5. Must be fast (< 100ms p95) — this is the type-ahead path.

**v1 mapping:** Direct replacement of `search_suggestions`. Same mixed
company/product structure. Dropped: `image_url` (replaced by
`imageFileId` — the `files` module serves the actual URL).

---

### 3.2 Projection refresh (system)

---

#### `search.refreshCompanyProjection`

| Field | Value |
| --- | --- |
| Name | `search.refreshCompanyProjection` |
| Description | Rebuild or remove the search projection for a single company. Invoked by event subscriptions when company publication state or profile changes. |
| Principal | `system` |
| Transport | `internal` |
| systemScope | `global` |
| Input | `{ companyId: z.string().uuid(), action: z.enum(["upsert", "remove"]) }` |
| Output | `{ companyId: z.string().uuid(), action: z.enum(["upserted", "removed", "skipped"]) }` |
| Permissions | `[]` |
| aiExposure | `internal` |
| risk | `write` |
| requiresConfirmation | `false` |
| Idempotent | `true` — natural: upsert is idempotent; remove of absent row is no-op |
| Emits | `[]` |
| Audit | `false` |
| Timeout | `10000` |

**Handler logic:**
1. **`upsert`**: Read the company from `companies` table (via read-model
   grant) where `publication_status = 'published'` and `deleted_at IS NULL`.
   Join `company_business_categories` + `business_categories` for category
   data. If the company qualifies, upsert into `search_companies` (INSERT
   ON CONFLICT UPDATE). If the company is not published or is deleted, fall
   through to remove.
2. **`remove`**: Delete from `search_companies` where
   `company_id = input.companyId`. Also delete all rows from
   `search_products` where `company_id = input.companyId` (a company
   unpublish/delete cascades to its products in the search projection).
3. Return `skipped` if `upsert` was requested but the company is not
   published (already absent from projection).

---

#### `search.refreshProductProjection`

| Field | Value |
| --- | --- |
| Name | `search.refreshProductProjection` |
| Description | Rebuild or remove the search projection for a single product. Invoked by event subscriptions when product publication/active state or attributes change. |
| Principal | `system` |
| Transport | `internal` |
| systemScope | `global` |
| Input | `{ productId: z.string().uuid(), companyId: z.string().uuid(), action: z.enum(["upsert", "remove"]) }` |
| Output | `{ productId: z.string().uuid(), action: z.enum(["upserted", "removed", "skipped"]) }` |
| Permissions | `[]` |
| aiExposure | `internal` |
| risk | `write` |
| requiresConfirmation | `false` |
| Idempotent | `true` — natural: upsert is idempotent; remove of absent row is no-op |
| Emits | `[]` |
| Audit | `false` |
| Timeout | `10000` |

**Handler logic:**
1. **`upsert`**: Read the product from `catalog` tables (via read-model
   grant) where the product is active and published. Verify the owning
   company exists in `search_companies` (company must be published). If
   both conditions hold, upsert into `search_products`. If either fails,
   fall through to remove.
2. **`remove`**: Delete from `search_products` where
   `product_id = input.productId`.
3. Return `skipped` if `upsert` was requested but the product is not
   eligible (inactive, unpublished, or company not published).

---

#### `search.rebuildAll`

| Field | Value |
| --- | --- |
| Name | `search.rebuildAll` |
| Description | Full rebuild of all search projections. Truncates projection tables and repopulates from source tables. For operational recovery or initial bootstrap. |
| Principal | `system` |
| Transport | `internal` |
| systemScope | `global` |
| Input | `{ }` |
| Output | `{ companiesCount: z.number().int(), productsCount: z.number().int(), durationMs: z.number().int() }` |
| Permissions | `[]` |
| aiExposure | `internal` |
| risk | `high` |
| requiresConfirmation | `false` |
| Idempotent | `true` — full rebuild produces the same result regardless of prior state |
| Emits | `[]` |
| Audit | `false` |
| Timeout | `120000` |

**Handler logic:**
1. In a single transaction:
   - Truncate `search_companies` and `search_products`.
   - Insert into `search_companies` from `companies` joined with
     `company_business_categories` + `business_categories` where
     `publication_status = 'published'` and `deleted_at IS NULL`.
   - Insert into `search_products` from catalog product tables (via
     read-model grant) joined with `search_companies` where the product is
     active and published.
2. Return counts and elapsed time.
3. During the transaction, consumer queries may see stale or empty results
   (acceptable for a rare operational action — see §5 for consistency
   discussion).

---

## 4. Events

### 4.1 Emitted

None. The search module is a read-only projection; it never emits domain
events. Consumer discovery reads are `audit: false`, `emits: []`.

### 4.2 Consumed

The search module subscribes to domain events from `companies` and `catalog`
to keep its projections current. Each subscription invokes an internal
idempotent system action.

| Source event | Subscription action | Behavior |
| --- | --- | --- |
| `companies.published` | `search.refreshCompanyProjection({ companyId, action: "upsert" })` | Upsert company into `search_companies`; then upsert all active published products for that company into `search_products` |
| `companies.unpublished` | `search.refreshCompanyProjection({ companyId, action: "remove" })` | Remove company and all its products from search projections |
| `companies.updated` | `search.refreshCompanyProjection({ companyId, action: "upsert" })` | Re-upsert if the company is published (name/bio/city/categories may have changed); no-op if unpublished |
| `companies.archived` | `search.refreshCompanyProjection({ companyId, action: "remove" })` | Remove company and all its products from search projections |
| `companies.categoriesUpdated` | `search.refreshCompanyProjection({ companyId, action: "upsert" })` | Update category facets if the company is published |
| `catalog.productPublished` | `search.refreshProductProjection({ productId, companyId, action: "upsert" })` | Add product to search if company is published |
| `catalog.productUnpublished` | `search.refreshProductProjection({ productId, companyId, action: "remove" })` | Remove product from search |
| `catalog.productUpdated` | `search.refreshProductProjection({ productId, companyId, action: "upsert" })` | Re-upsert if product is active/published and company is published |
| `catalog.productDeleted` | `search.refreshProductProjection({ productId, companyId, action: "remove" })` | Remove product from search |
| `catalog.productsStatusChanged` | `search.refreshProductProjection` (batch) | Rebuild projections for affected products |

**Event ordering and idempotency:** Event consumers are idempotent — a
duplicate delivery re-runs the upsert or remove, producing the same result.
The outbox guarantees at-least-once delivery (blueprint §6). If events arrive
out of order (e.g., `productUpdated` before `published`), the upsert
handler's source-table query catches the current state, not the event
payload — the projection is always rebuilt from the authoritative source.

**Cascade behavior:** When a company is unpublished or deleted, the company
refresh action also removes all products for that company from
`search_products`. This prevents orphaned product projections.

### 4.3 Read-model grants consumed

| Grantor | Tables | Access | Purpose |
| --- | --- | --- | --- |
| `companies` | `companies`, `company_business_categories`, `business_categories` | SELECT (read-only) | Rebuild published-company projections and category filter dimensions |
| `catalog` | `products`, `product_categories`, `product_media` | SELECT (read-only) | Rebuild published-product projections with name, category, primary image |

These grants are declared in the owning module specs. Search projections are
not domain authority (ADR-0011/0015). The `companies` spec §4.3 already
declares the company-side grants. The `catalog` spec must declare the
product-side grants when written.

**Production usage:** Read-model grants are used by the system-principal
refresh actions to read source tables and populate projection tables. Consumer
actions query only the owned projection tables — they never touch `companies`
or `catalog` tables directly.

## 5. State machines and concurrency

### 5.1 Projection lifecycle

Search projection rows do not have a formal state machine — they are either
present (published/active) or absent (unpublished/deleted/inactive). The
lifecycle is driven entirely by consumed events:

```
Source published/activated  ──event──▸  upsert into projection table
Source unpublished/deleted   ──event──▸  remove from projection table
Source profile/data updated  ──event──▸  re-upsert (if still published)
```

### 5.2 Consistency model

Search projections are **eventually consistent** with the source domain
tables. The lag is bounded by the outbox polling interval + event consumer
processing time (typically < 1 second under normal load).

**Concurrent refresh of the same entity:** Two concurrent upserts for the
same `company_id` or `product_id` are safe because `INSERT ... ON CONFLICT
... DO UPDATE` is atomic. The last writer wins, and both read the current
authoritative state from the source table — so the final projection is
correct regardless of execution order.

**Full rebuild vs. incremental:** `search.rebuildAll` truncates and
repopulates in a single transaction. During this window, concurrent consumer
reads may see empty results. This is acceptable because `rebuildAll` is a
rare operational action (bootstrap, recovery), not a routine operation. A
future optimization could use a shadow-table swap (`CREATE TABLE ... AS
SELECT`, then `ALTER TABLE RENAME`) to achieve zero-downtime rebuild if
needed.

### 5.3 Concurrency on consumer reads

Consumer read actions are stateless SELECTs against projection tables with
no write side effects. They are safe to execute concurrently without locks.

## 6. Edge cases

1. **Company published with no products** — The company appears in search
   results with no product matches. Product results are empty for that
   company until products are activated and published. (v1: `search_browse`
   showed companies even with zero products.)

2. **Product activated before company published** — The product event handler
   checks `search_companies` for the owning company. If the company is not
   yet published, the product is skipped (`action: "skipped"`). When the
   company is later published, `companies.published` triggers a company
   upsert, which also upserts all active published products for that company.

3. **Company unpublished while products exist** —
   `search.refreshCompanyProjection({ action: "remove" })` cascades: removes
   the company row from `search_companies` AND all product rows from
   `search_products` where `company_id` matches. No orphaned products.

4. **Rapid publish/unpublish/publish** — Each state change emits an event.
   Events are processed in outbox order. If all three complete before
   processing starts, the consumer processes them sequentially: upsert →
   remove → upsert. The final state is correct. If processing interleaves
   with more events, each handler reads the current source state, so the
   projection converges to truth.

5. **Query too short (< 2 chars) in `search.suggest`** — Input validation
   rejects with `ValidationError`. (v1 `search_suggestions`: returned empty
   set for < 2 chars; v2 fails fast with typed error.)

6. **Empty query in `search.discover`** — Valid; returns browse mode (recent
   published companies by `published_at`). No product results in browse mode
   because there is no relevance signal for product ranking without a query.

7. **Query matches products but not the company name** — The company still
   appears in results if any of its products match. This mirrors v1
   `search_browse`'s `product_scores` CTE behavior: a company is surfaced
   when its products match even if its own name/bio does not.

8. **Stale projection after source update** — Eventual consistency: the
   projection lags source changes by the outbox interval. Consumer reads
   during this window return slightly stale data. Acceptable for a discovery
   surface; not used for transactional decisions.

9. **Projection table empty (fresh deployment / after truncate)** —
   `search.discover` returns empty results. `search.rebuildAll` must be run
   to bootstrap projections from existing published data.

10. **Category filter with invalid slug** — Returns empty results (no
    matching `category_slugs`). No error — treated as "no companies in this
    category."

11. **Concurrent `rebuildAll` invocations** — Both truncate and repopulate.
    The table-level lock on truncate serializes them. The second rebuild is
    redundant but harmless (idempotent by nature).

12. **Company profile updated but still unpublished** — The
    `companies.profileUpdated` consumer calls
    `refreshCompanyProjection({ action: "upsert" })`. The handler reads the
    source company, finds it unpublished, and returns `skipped`. No
    projection change. (v1: no equivalent — `fts` was a column on the
    company table, always present.)

## 7. v1 migration notes

V2 starts with a **clean database** (no search projection import). These
notes serve as behavioral reference and architectural mapping.

### 7.1 Tables

| v1 object | v2 decision | Notes |
| --- | --- | --- |
| `companies.fts` (generated `tsvector` column) | DROP from `companies` table; TRANSFORM to `search_companies.search_vector` | FTS authority moves from a column on the domain table to a dedicated projection table owned by `search` |
| `companies.embedding` (pgvector 1536-d) | DROP | Vector/semantic search dropped (ADR-0018) |
| `companies.keywords` (`20260320000010`) | DROP | Not carried; FTS projection uses name/bio/city/area |
| `products.fts` (generated `tsvector` column) | DROP from `products` table; TRANSFORM to `search_products.search_vector` | Same pattern: FTS authority moves to search projection |
| `products.embedding` | DROP | Vector search dropped |
| `consumer_products_view` | DROP | Physical view replaced by search projection tables + catalog domain reads. Published-product behavior becomes `catalog` domain reads and `search` FTS projections (migration matrix) |
| No partitioned analytics search tables | N/A | v1 analytics tables (`analytics.company_daily_stats` etc.) dropped; v2 uses direct queries |

### 7.2 Dropped indexes (from domain tables)

| v1 index | Decision | Notes |
| --- | --- | --- |
| `idx_companies_fts` (GIN on `companies.fts`) | DROP | FTS authority → `search_companies.search_vector` |
| `idx_companies_name_trgm` (GIN trigram on `companies.name`) | DROP | Trigram → `search_companies.name_normalized` |
| `idx_companies_embedding` (HNSW on `companies.embedding`) | DROP | Vector dropped |
| `idx_companies_latitude`, `idx_companies_longitude` | DROP | Geo dropped |
| Product FTS/embedding/trigram indexes | DROP | Same pattern → `search_products` |

### 7.3 Functions and RPCs

| v1 function | v2 decision | Target |
| --- | --- | --- |
| `search_browse` (`20260301000019`, updated in `20260408000001`) | TRANSFORM | `search.discover` action. Dropped: embedding scoring, geo-radius, city/area text filter, `popular`/`nearest` sort, `top_products` with resolved prices, `followers_count`/`orders_count` denorms. Retained: FTS + trigram company/product matching, category filter, cursor pagination, relevance ranking |
| `search_suggestions` (`20260301000019`) | TRANSFORM | `search.suggest` action. Same mixed company/product autocomplete. Dropped: `image_url` (replaced by `imageFileId`) |
| `escape_like_pattern` (`20260301000019`) | DROP for search | Utility function; search uses FTS/trigram, not LIKE patterns |
| `assistant_search_products` (`20260410000002`) | TRANSFORM | Becomes a company-scoped `catalog` staff action (not owned by `search`; search is global consumer discovery only) |
| `assistant_search_customers` (`20260410000002`) | TRANSFORM | Becomes a `customers` staff action |
| `assistant_search_counterparties` (`20260410000002`) | TRANSFORM | Becomes a `customers` staff action |
| `assistant_search_orders` (`20260410000002`) | TRANSFORM | Becomes an `orders` staff action |

### 7.4 Views

| v1 view | v2 decision | Notes |
| --- | --- | --- |
| `consumer_products_view` (`20260301000019`, updated in `20260312000001`) | DROP | Published-product projection logic moves to `search_products` for discovery; company-page product display becomes `catalog` domain reads. Engagement data (likes, comments, followed state) dropped |

### 7.5 RLS policies

All v1 RLS policies on search-adjacent objects are **dropped**:

| v1 policy context | v2 mapping |
| --- | --- |
| `search_browse`: `SECURITY DEFINER`, callable by anon/authenticated | `search.discover`: `consumer` principal (authenticated only; ADR-0018 drops anonymous) |
| `search_suggestions`: `SECURITY DEFINER`, callable by anon/authenticated | `search.suggest`: `consumer` principal |
| `consumer_products_view`: `security_invoker = on` + RLS on underlying tables | DROP view; projection tables have no RLS; consumer actions enforce published-only via projection design |

### 7.6 Extensions

| Extension | Decision |
| --- | --- |
| `pg_trgm` | KEEP — trigram similarity for fuzzy matching |
| `unaccent` | KEEP — accent-insensitive normalization |
| `vector` (pgvector) | DROP — semantic search dropped (ADR-0018) |

### 7.7 Seed and bootstrap

1. Run drizzle-kit migration creating `search_companies` and
   `search_products` with indexes.
2. After `companies` and `catalog` tables are populated, run
   `search.rebuildAll` to bootstrap projections.
3. No v1 search data import — projections are rebuilt from source.
4. Rollback: drop projection tables and re-run migration. No domain data at
   risk (projections are disposable).

## 8. Non-functional requirements

- **Latency targets:**
  - `search.suggest` (autocomplete): < 100ms p95 — this is the type-ahead
    path; users expect instant feedback.
  - `search.discover` (full search): < 300ms p95 for text queries; < 200ms
    p95 for browse-only (no query, category filter or default sort).
- **Projection lag tolerance:** < 2 seconds from source event to projection
  update under normal load. Projection staleness is acceptable for discovery;
  it is not used for transactional decisions.
- **Rate limits:** Consumer discovery reads at 60/min per user (core.md §10).
  `search.suggest` may warrant a tighter limit (120/min per user) due to
  type-ahead frequency, but uses the same per-user consumer tier.
- **Expected volumes:** Hundreds of companies, thousands of products at V2
  launch. Projection tables are small; GIN indexes fit in memory.
  `search.rebuildAll` completes in < 5 seconds for this scale.
- **No PII in projections:** Projection tables contain only published public
  facts (name, bio, city, area, slug, categories). No email, phone, legal
  data, or user-identifying information enters search projections.
- **Payload size:** `search.discover` response capped at 50 results per page.
  Individual result cards are lightweight (~200 bytes each). Total response
  < 15 KB.

## 9. Acceptance criteria

Mandatory minimum:

- [ ] Consumer actions (`search.discover`, `search.suggest`): contract check
      rejects `resolveTarget`; only published companies and active published
      products appear in results; no CRM creation/side effects; `audit: false`
      and `emits: []`; instantiate inherited `consumerIsolationSuite` from
      core.md §12.
- [ ] Unpublished companies and inactive/unpublished products never appear in
      any consumer search result — verified by inserting unpublished test data
      and confirming zero matches.
- [ ] Validation failure surfaces typed errors (`ValidationError` for invalid
      input shapes).
- [ ] Output validates at runtime and is JSON-safe.
- [ ] System actions (`refreshCompanyProjection`, `refreshProductProjection`,
      `rebuildAll`) are idempotent — repeated execution produces the same
      projection state.
- [ ] No events emitted by any search action (contract check: `emits: []`
      for all actions).
- [ ] No audit records written by any search action (`audit: false` for all
      actions).

Module-specific:

- [ ] **FTS matching:** `search.discover` with a text query returns companies
      whose name or bio matches via `plainto_tsquery('simple', ...)` and
      products whose name matches. Verified with Ukrainian text (Cyrillic
      word boundaries, simple config).
- [ ] **Trigram matching:** `search.discover` and `search.suggest` return
      results for fuzzy/partial queries via `pg_trgm` similarity > 0.15.
      Verified with partial company/product names and minor typos.
- [ ] **Accent insensitivity:** Queries with and without Ukrainian accents
      (e.g., "кава" vs "Кава") return the same results via `unaccent`.
- [ ] **Category filter:** `search.discover` with `categorySlug` returns
      only companies tagged with that business category. Companies without
      the category are excluded.
- [ ] **Mixed results:** `search.discover` with a query returns both company
      and product matches. A company appears in results if its products match
      even when the company name does not match.
- [ ] **Suggestions:** `search.suggest` returns a mixed list of company and
      product name suggestions with correct type, subtitle, and imageFileId.
      Capped at 10 results. Response time < 100ms p95.
- [ ] **Browse mode:** `search.discover` without a query returns recently
      published companies ordered by `published_at DESC`. No product results
      in browse mode.
- [ ] **Cursor pagination:** Sequential `search.discover` calls with
      `nextCursor` produce non-overlapping, complete result pages.
- [ ] **Projection refresh — company published:** `companies.published`
      event causes the company to appear in `search.discover` results.
- [ ] **Projection refresh — company unpublished:** `companies.unpublished`
      event removes the company AND all its products from search results.
- [ ] **Projection refresh — company deleted:** `companies.deleted` event
      removes the company AND all its products from search results.
- [ ] **Projection refresh — product activated:** `catalog.productActivated`
      event causes the product to appear in search results (if company is
      published).
- [ ] **Projection refresh — product deactivated:**
      `catalog.productDeactivated` event removes the product from search
      results.
- [ ] **Projection refresh — product updated:** `catalog.productUpdated`
      event updates the product's searchable fields in the projection.
- [ ] **Product skipped when company unpublished:** Activating a product for
      an unpublished company does not add it to search projections. Publishing
      the company subsequently adds the product.
- [ ] **Full rebuild:** `search.rebuildAll` produces the same projection
      state as incremental event processing. Company and product counts match
      source table published/active counts.
- [ ] **No pricing in results:** No search action output contains price,
      discount, or pricing-related fields.
- [ ] **No domain authority:** Search projection tables are disposable —
      dropping and rebuilding them loses no domain state. Verified by
      `rebuildAll` after truncate producing identical results.

## 10. Composition contract

### Callee capabilities (this module provides)

| Caller | Action | Principal compat | What caller needs |
| --- | --- | --- | --- |
| Mobile/web client | `search.discover` | consumer | Global company/product discovery |
| Mobile/web client | `search.suggest` | consumer | Type-ahead autocomplete |
| `assistant` (AI) | `search.discover` | consumer | AI-driven discovery queries |
| `assistant` (AI) | `search.suggest` | consumer | AI-driven autocomplete |

### Outbound dependencies

| Dependency type | Source | What search needs |
| --- | --- | --- |
| Event subscription | `companies.published`, `.unpublished`, `.profileUpdated`, `.deleted` | Trigger company projection refresh |
| Event subscription | `catalog.productActivated`, `.productDeactivated`, `.productUpdated`, `.productDeleted` | Trigger product projection refresh |
| Read-model grant | `companies` tables (§4.3) | Rebuild company projections from source |
| Read-model grant | `catalog` tables (§4.3) | Rebuild product projections from source |

Search has **no `ctx.call` dependencies** — refresh actions read source
tables directly via read-model grants (system principal, internal transport).
Consumer actions read only owned projection tables.

## Changelog

| Date | Change | Why | Reported by |
| --- | --- | --- | --- |
| 2026-08-17 | Initial draft | Spec-rework queue Step 3c: full search module | spec agent |
