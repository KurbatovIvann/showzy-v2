# Spec: companies

> Status: Living.
> Written against blueprint §2.1, §4, §5; scope §2, §6; ADR-0013, ADR-0014,
> ADR-0015, ADR-0018; module-ownership.md; spec-rework-queue Step 3.

## 1. Purpose

The `companies` module owns the **tenant root** (the company entity), **team
membership and RBAC**, **legal requisites**, **public profile and showcase
configuration**, **business-category taxonomy**, and the **publication
lifecycle** that controls consumer discovery visibility.

It does **NOT** own: CRM customer records (`customers`), catalog or products
(`catalog`), order statuses (`orders`), payment settings (`payments`), file
storage (`files`), or global text search projections (`search`). The `search`
module receives a read-model grant to query published company data for FTS
projections.

---

## 2. Owned tables

All tables live in `packages/db/src/schema/companies.ts` (ADR-0014).

### 2.1 `companies`

| Column | Type | Constraints | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `name` | `text` | NOT NULL | Company display name |
| `slug` | `text` | NOT NULL, UNIQUE, CHECK `^[a-z0-9][a-z0-9-]*[a-z0-9]$` | URL identifier for public profile |
| `prefix` | `text` | NOT NULL, UNIQUE | Auto-generated; used for order/document numbering |
| `email` | `text` | nullable | Contact email |
| `phone` | `text` | nullable | Contact phone |
| `logo_url` | `text` | nullable | S3 path (managed via `files` module) |
| `bio` | `text` | nullable | Short description (~200 chars) |
| `about_html` | `text` | nullable | Rich HTML for "About" section |
| `city` | `text` | nullable | City name |
| `city_ref` | `text` | nullable | Nova Poshta city reference ID |
| `area` | `text` | nullable | Oblast/region |
| `address` | `text` | nullable | Street address |
| `working_hours` | `jsonb` | nullable | Structured schedule |
| `keywords` | `text[]` | default `'{}'` | Free-form tags for discoverability |
| `publication_status` | `text` | NOT NULL, default `'draft'`, CHECK `('draft','published','unpublished')` | Controls consumer discovery visibility |
| `published_at` | `timestamptz` | nullable | Set on first publish |
| `archived_at` | `timestamptz` | nullable | Soft-archive timestamp; NULL = active |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |

**Indexes:**
- `UNIQUE (slug)`
- `UNIQUE (prefix)`
- GIN on `keywords`
- `(publication_status) WHERE publication_status = 'published'` — partial index for discovery queries
- GIN tsvector index for FTS (generated column or expression index over `name`, `bio`, `city`, `area`, `keywords`, `address`)

**Dropped from v1:** `embedding` (vector), `followers_count`, `products_count`,
`orders_count` (denormalized counters), `latitude`/`longitude` (geo-radius
dropped), `reviews_enabled` (follows/reviews dropped), `fts` as a stored
generated column (moved to a search-module projection or a GIN expression
index managed by `companies` for read-model grant).

### 2.2 `company_members`

| Column | Type | Constraints | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `company_id` | `uuid` | NOT NULL, FK → `companies(id)` ON DELETE CASCADE | |
| `user_id` | `text` | NOT NULL, FK → better-auth `user(id)` ON DELETE RESTRICT | better-auth generated ID type |
| `role` | `text` | NOT NULL, CHECK `('owner','admin','manager','employee')` | |
| `permissions` | `jsonb` | NOT NULL, default `'{"granted":[],"denied":[]}'` | Per-member overrides |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |

**Constraints:**
- UNIQUE `(company_id, user_id)`

**Indexes:**
- `(user_id, company_id)` — for listing a user's companies
- `(company_id, role)` — for team queries by role

**Permission resolution (carried from v1 `has_company_permission`):**
1. `owner` role → implicitly all permissions (short-circuit true)
2. Explicit `denied` array → short-circuit false
3. Explicit `granted` array → true
4. Fall through to `role_permission_defaults` → true if present, false otherwise

### 2.3 `role_permission_defaults`

| Column | Type | Constraints | Notes |
| --- | --- | --- | --- |
| `role` | `text` | NOT NULL | `admin`, `manager`, `employee` (owner has all implicitly) |
| `permission` | `text` | NOT NULL | Permission key `<resource>:<action>` format |

**Constraints:**
- PK `(role, permission)`

Populated via a seed migration. Unknown permission keys are rejected by the
action contract/catalog check at CI time.

### 2.4 `company_legal_info`

| Column | Type | Constraints | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `company_id` | `uuid` | NOT NULL, FK → `companies(id)` ON DELETE CASCADE, UNIQUE | One-to-one |
| `company_type` | `text` | NOT NULL, default `'fop'`, CHECK `('fop','tov')` | FOP = sole proprietor, TOV = LLC |
| `legal_name` | `text` | nullable | e.g. "ФОП Іванов І.І." |
| `edrpou` | `text` | nullable | Tax ID (8–10 digits) |
| `legal_address` | `text` | nullable | Registration address |
| `iban` | `text` | nullable | UA + 27 digits |
| `bank_name` | `text` | nullable | |
| `bank_mfo` | `text` | nullable | 6-digit routing code |
| `bank_edrpou` | `text` | nullable | Bank's EDRPOU |
| `phone` | `text` | nullable | Contact for documents |
| `email` | `text` | nullable | Contact for documents |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |

### 2.5 `company_socials`

| Column | Type | Constraints | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `company_id` | `uuid` | NOT NULL, FK → `companies(id)` ON DELETE CASCADE | |
| `platform` | `text` | NOT NULL | e.g. `instagram`, `facebook`, `telegram` |
| `url` | `text` | NOT NULL | Full URL |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |

**Indexes:**
- `(company_id)` — for listing all socials of a company

### 2.6 `showcase_config`

| Column | Type | Constraints | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `company_id` | `uuid` | NOT NULL, FK → `companies(id)` ON DELETE CASCADE, UNIQUE | One-to-one |
| `sections` | `jsonb` | NOT NULL, default (see below) | Header/hero/products/footer config |
| `theme` | `jsonb` | NOT NULL, default `'{}'` | Theme overrides |
| `seo` | `jsonb` | NOT NULL, default `'{}'` | title, description, keywords, ogImage |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |

Default `sections` value mirrors v1: `{ header: { visible, order, showLogo,
showContact, showSocials }, hero: { visible, order, style, title, description,
imageUrl, ctaText, ctaUrl }, products: { visible, order, layout, showFilters },
footer: { visible, order, showLinks, showSocials } }`.

### 2.7 `business_categories`

| Column | Type | Constraints | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `slug` | `text` | NOT NULL, UNIQUE | URL-friendly identifier |
| `name_en` | `text` | NOT NULL | English name |
| `name_uk` | `text` | NOT NULL | Ukrainian name |
| `icon` | `text` | nullable | Lucide icon name |
| `display_order` | `integer` | NOT NULL, default `0` | Sort order |
| `is_active` | `boolean` | NOT NULL, default `true` | Soft-disable |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

Global reference data. Populated via seed migration. No `company_id` — this
is a system-wide taxonomy. Managed only by `system` actions or migrations.

### 2.8 `company_business_categories`

| Column | Type | Constraints | Notes |
| --- | --- | --- | --- |
| `company_id` | `uuid` | NOT NULL, FK → `companies(id)` ON DELETE CASCADE | |
| `category_id` | `uuid` | NOT NULL, FK → `business_categories(id)` ON DELETE CASCADE | |

**Constraints:**
- PK `(company_id, category_id)`

**Indexes:**
- `(category_id)` — for filtering companies by category

---

## 3. Actions

### 3.1 `companies.create`

| Field | Value |
| --- | --- |
| Name | `companies.create` |
| Description | Create a new company and become its owner |
| Principal | `account` |
| Transport | `client` |
| Target/system scope | N/A (account-level; user from session) |
| Input | `{ name: string, slug: string, email?: string, city?: string, cityRef?: string, area?: string, address?: string }` |
| Output | `{ id: string, name: string, slug: string, prefix: string }` |
| Permissions | `[]` |
| aiExposure | `exposed` |
| risk | `write` |
| requiresConfirmation | `false` |
| Idempotent | `false` |
| Emits | `["companies.created"]` |
| Audit | `true` |
| Audit target | Company ID from result |
| Timeout | `5_000` |
| Calls | — |

**Behavior:**
- Validates slug uniqueness and format.
- Generates a `prefix` from the name (application-code logic replacing the v1
  `set_company_prefix` trigger).
- Enforces a maximum of 2 companies per user where the user is an owner.
- Creates the company row with `publication_status = 'draft'`.
- Creates a `company_members` row with `role = 'owner'` for the caller.
- Creates a default `showcase_config` row.
- Emits `companies.created`.

### 3.2 `companies.get`

| Field | Value |
| --- | --- |
| Name | `companies.get` |
| Description | Get full company details for a staff member |
| Principal | `staff` |
| Transport | `client` |
| Input | `{}` (companyId from context) |
| Output | Full company object with socials, legal info, showcase, categories |
| Permissions | `[]` (any member can view their own company) |
| aiExposure | `exposed` |
| risk | `read` |
| requiresConfirmation | `false` |
| Idempotent | `false` |
| Emits | `[]` |
| Audit | `false` |
| Timeout | `3_000` |
| Calls | — |

### 3.3 `companies.update`

| Field | Value |
| --- | --- |
| Name | `companies.update` |
| Description | Update company profile information |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ name?: string, slug?: string, email?: string, phone?: string, bio?: string, aboutHtml?: string, city?: string, cityRef?: string, area?: string, address?: string, workingHours?: JsonSchedule, keywords?: string[] }` |
| Output | Updated company object |
| Permissions | `["settings:general"]` |
| aiExposure | `exposed` |
| risk | `write` |
| requiresConfirmation | `false` |
| Idempotent | `false` |
| Emits | `["companies.updated"]` |
| Audit | `true` |
| Audit target | `ctx.companyId` |
| Timeout | `5_000` |
| Calls | — |

**Behavior:**
- If `slug` changes, validates uniqueness and format. Emitting the event
  allows the `search` module to update its projection.
- If `name` changes and the company has never published, the `prefix` may be
  regenerated (once published, prefix is frozen to preserve order numbers).

### 3.4 `companies.archive`

| Field | Value |
| --- | --- |
| Name | `companies.archive` |
| Description | Soft-archive a company (hides from all surfaces) |
| Principal | `staff` |
| Transport | `client` |
| Input | `{}` |
| Output | `{ id: string, archivedAt: string }` |
| Permissions | `["settings:general"]` (only owner in practice — enforced by handler) |
| aiExposure | `exposed` |
| risk | `high` |
| requiresConfirmation | `true` |
| Confirmation summary | Returns company name, member count, active order count |
| Idempotent | `true` — repeated calls on an already-archived company are no-ops |
| Emits | `["companies.archived"]` |
| Audit | `true` |
| Audit target | `ctx.companyId` |
| Timeout | `5_000` |
| Calls | `orders.countActive` (read) for confirmation summary |

**Behavior:**
- Sets `archived_at = now()`, sets `publication_status = 'unpublished'`.
- Only the owner may archive. The handler checks `ctx.membership.role === 'owner'`
  in addition to permission.
- An archived company is invisible in all surfaces (staff panel shows a
  banner, consumer discovery excludes it).

### 3.5 `companies.restore`

| Field | Value |
| --- | --- |
| Name | `companies.restore` |
| Description | Restore a previously archived company |
| Principal | `account` |
| Transport | `client` |
| Input | `{ companyId: string }` |
| Output | `{ id: string, name: string }` |
| Permissions | `[]` |
| aiExposure | `exposed` |
| risk | `write` |
| requiresConfirmation | `false` |
| Idempotent | `true` — restoring an active company is a no-op |
| Emits | `["companies.restored"]` |
| Audit | `true` |
| Audit target | `input.companyId` |
| Timeout | `5_000` |
| Calls | — |

**Behavior:**
- `account` principal: the handler verifies the caller is an owner of
  `input.companyId` by loading the membership. `companyId` in input is NOT a
  grant — it is a selector for the handler's ownership check.
- Sets `archived_at = null`. Does NOT automatically re-publish; the company
  returns to `publication_status = 'unpublished'` (requires explicit publish).

### 3.6 `companies.listMyCompanies`

| Field | Value |
| --- | --- |
| Name | `companies.listMyCompanies` |
| Description | List all companies where the current user is a member |
| Principal | `account` |
| Transport | `client` |
| Input | `{ includeArchived?: boolean }` |
| Output | `Array<{ id, name, slug, role, logoUrl, publicationStatus, archivedAt }>` |
| Permissions | `[]` |
| aiExposure | `exposed` |
| risk | `read` |
| requiresConfirmation | `false` |
| Idempotent | `false` |
| Emits | `[]` |
| Audit | `false` |
| Timeout | `3_000` |
| Calls | — |

### 3.7 `companies.publish`

| Field | Value |
| --- | --- |
| Name | `companies.publish` |
| Description | Publish the company so it appears in consumer discovery |
| Principal | `staff` |
| Transport | `client` |
| Input | `{}` |
| Output | `{ id: string, publicationStatus: 'published', publishedAt: string }` |
| Permissions | `["settings:general"]` |
| aiExposure | `exposed` |
| risk | `write` |
| requiresConfirmation | `false` |
| Idempotent | `true` — publishing an already-published company is a no-op |
| Emits | `["companies.published"]` |
| Audit | `true` |
| Audit target | `ctx.companyId` |
| Timeout | `5_000` |
| Calls | — |

**Behavior:**
- Transitions `publication_status` to `'published'`.
- Sets `published_at = now()` on first publish (never overwritten on re-publish).
- Freezes `prefix` permanently.
- Validates minimum profile completeness: `name`, `slug`, at least one
  business category. Returns typed error if prerequisites unmet.

### 3.8 `companies.unpublish`

| Field | Value |
| --- | --- |
| Name | `companies.unpublish` |
| Description | Unpublish the company (remove from consumer discovery) |
| Principal | `staff` |
| Transport | `client` |
| Input | `{}` |
| Output | `{ id: string, publicationStatus: 'unpublished' }` |
| Permissions | `["settings:general"]` |
| aiExposure | `exposed` |
| risk | `write` |
| requiresConfirmation | `false` |
| Idempotent | `true` — unpublishing a non-published company is a no-op |
| Emits | `["companies.unpublished"]` |
| Audit | `true` |
| Audit target | `ctx.companyId` |
| Timeout | `5_000` |
| Calls | — |

**Behavior:**
- Transitions `publication_status` to `'unpublished'`.
- Does NOT archive the company — the owner/staff can still manage it; it's
  just hidden from consumer discovery and public direct links.
- Existing customers with CRM records retain access; only discovery and
  public entry are blocked.

### 3.9 `companies.getPublishedProfile`

| Field | Value |
| --- | --- |
| Name | `companies.getPublishedProfile` |
| Description | Get the public profile of a published company by slug |
| Principal | `public` |
| Transport | `client` |
| Target | Typed `resolveTarget(input, { tx, principal })` verifies: company exists, `publication_status = 'published'`, `archived_at IS NULL`. Returns `{ companyId }`. |
| Input | `{ slug: string }` |
| Output | `{ id, name, slug, bio, aboutHtml, logoUrl, city, area, address, workingHours, keywords, socials: Array<{platform, url}>, showcaseConfig: {...}, categories: Array<{slug, nameEn, nameUk, icon}>, publishedAt }` |
| Permissions | `[]` |
| aiExposure | `exposed` |
| risk | `read` |
| requiresConfirmation | `false` |
| Idempotent | `false` |
| Emits | `[]` |
| Audit | `false` |
| Timeout | `3_000` |
| Calls | — |

**Behavior:**
- The `resolveTarget` callback proves the company is published; slug is a
  selector, not a grant.
- Returns the public-safe subset of company data (no legal info, no team info,
  no internal settings).

### 3.10 `companies.listPublishedByCategory`

| Field | Value |
| --- | --- |
| Name | `companies.listPublishedByCategory` |
| Description | List published companies filtered by a business category |
| Principal | `consumer` |
| Transport | `client` |
| Target/system scope | N/A (consumer — no company scope, no resolveTarget) |
| Input | `{ categorySlug: string, cursor?: string, limit?: number }` |
| Output | `{ items: Array<{ id, name, slug, bio, logoUrl, city, categories: Array<{slug, nameUk}> }>, nextCursor: string | null }` |
| Permissions | `[]` |
| aiExposure | `exposed` |
| risk | `read` |
| requiresConfirmation | `false` |
| Idempotent | `false` |
| Emits | `[]` |
| Audit | `false` |
| Timeout | `3_000` |
| Calls | — |

**Behavior:**
- Cursor-based pagination over published, non-archived companies that have
  the specified category.
- Only `published` + `archived_at IS NULL` companies are returned.
- No CRM side effects.

### 3.11 `companies.listPublished`

| Field | Value |
| --- | --- |
| Name | `companies.listPublished` |
| Description | List all published companies for consumer discovery |
| Principal | `consumer` |
| Transport | `client` |
| Target/system scope | N/A |
| Input | `{ cursor?: string, limit?: number }` |
| Output | Same shape as `listPublishedByCategory` |
| Permissions | `[]` |
| aiExposure | `exposed` |
| risk | `read` |
| requiresConfirmation | `false` |
| Idempotent | `false` |
| Emits | `[]` |
| Audit | `false` |
| Timeout | `3_000` |
| Calls | — |

### 3.12 `companies.getPublishedById`

| Field | Value |
| --- | --- |
| Name | `companies.getPublishedById` |
| Description | Get a published company's public profile by ID (for consumer context) |
| Principal | `consumer` |
| Transport | `client` |
| Target/system scope | N/A |
| Input | `{ companyId: string }` |
| Output | Same shape as `getPublishedProfile` output |
| Permissions | `[]` |
| aiExposure | `exposed` |
| risk | `read` |
| requiresConfirmation | `false` |
| Idempotent | `false` |
| Emits | `[]` |
| Audit | `false` |
| Timeout | `3_000` |
| Calls | — |

**Behavior:**
- Returns the same public-safe profile as `getPublishedProfile` but uses
  `companyId` as input. Verifies `publication_status = 'published'` and
  `archived_at IS NULL` in the query; returns a typed NotFoundError if the
  company is not published.
- No `resolveTarget` (consumer principal); the query itself enforces
  published-only access.

### 3.13 `companies.getPublishedCompany`

| Field | Value |
| --- | --- |
| Name | `companies.getPublishedCompany` |
| Description | Verify a company exists and is published; return its public profile. Used by other modules (e.g., chat) as an existence + publication proof inside `resolveTarget` via `ctx.call` |
| Principal | `customer` |
| Transport | `internal` |
| Target/system scope | Typed `resolveTarget`: loads company by `companyId`, verifies `publication_status = 'published'` and `archived_at IS NULL` |
| Input | `{ companyId: string }` |
| Output | Same shape as `getPublishedProfile` output |
| Permissions | `[]` |
| aiExposure | `internal` |
| risk | `read` |
| requiresConfirmation | `false` |
| Idempotent | N/A (read) |
| Emits | `[]` |
| Audit | `false` |
| Timeout | default |
| Calls | — |

**Behavior:**
- Returns the company's public-safe profile if published and not archived.
- Returns `NotFoundError` if the company does not exist, is not published,
  or is archived.
- This is the `ctx.call` target for chat's `openMyConversation` resolveTarget
  (ADR-0018 publication rule). The customer principal allows it to be called
  from customer-context resolvers.

---

### 3.14 `companies.listCategories`

| Field | Value |
| --- | --- |
| Name | `companies.listCategories` |
| Description | List all active business categories |
| Principal | `consumer` |
| Transport | `client` |
| Target/system scope | N/A |
| Input | `{}` |
| Output | `Array<{ id, slug, nameEn, nameUk, icon, displayOrder }>` |
| Permissions | `[]` |
| aiExposure | `exposed` |
| risk | `read` |
| requiresConfirmation | `false` |
| Idempotent | `false` |
| Emits | `[]` |
| Audit | `false` |
| Timeout | `3_000` |
| Calls | — |

**Behavior:**
- Returns only `is_active = true` categories, sorted by `display_order`.

### 3.14 `companies.updateCategories`

| Field | Value |
| --- | --- |
| Name | `companies.updateCategories` |
| Description | Set the business categories for the company (replaces all) |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ categoryIds: string[] }` (max 5) |
| Output | `Array<{ id, slug, nameEn, nameUk }>` |
| Permissions | `["showcase:edit"]` |
| aiExposure | `exposed` |
| risk | `write` |
| requiresConfirmation | `false` |
| Idempotent | `true` — same input produces same result |
| Emits | `["companies.categoriesUpdated"]` |
| Audit | `true` |
| Audit target | `ctx.companyId` |
| Timeout | `5_000` |
| Calls | — |

**Behavior:**
- Deletes existing `company_business_categories` rows and inserts the new set
  in one transaction.
- Validates all `categoryIds` reference active `business_categories` rows.
- Maximum 5 categories per company (business rule from v1 UI).

### 3.15 `companies.updateLegalInfo`

| Field | Value |
| --- | --- |
| Name | `companies.updateLegalInfo` |
| Description | Create or update the company's legal requisites |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ companyType?: 'fop' | 'tov', legalName?: string, edrpou?: string, legalAddress?: string, iban?: string, bankName?: string, bankMfo?: string, bankEdrpou?: string, phone?: string, email?: string }` |
| Output | Full `company_legal_info` row |
| Permissions | `["settings:payments"]` |
| aiExposure | `exposed` |
| risk | `write` |
| requiresConfirmation | `false` |
| Idempotent | `false` |
| Emits | `["companies.legalInfoUpdated"]` |
| Audit | `true` |
| Audit target | `ctx.companyId` |
| Timeout | `5_000` |
| Calls | — |

**Behavior:**
- Upserts on `company_id` (one-to-one).
- Validates IBAN format (UA + 27 digits) and EDRPOU format (8–10 digits) when
  provided.

### 3.16 `companies.getLegalInfo`

| Field | Value |
| --- | --- |
| Name | `companies.getLegalInfo` |
| Description | Get the company's legal requisites |
| Principal | `staff` |
| Transport | `client` |
| Input | `{}` |
| Output | `company_legal_info` row or `null` |
| Permissions | `["settings:payments"]` |
| aiExposure | `exposed` |
| risk | `read` |
| requiresConfirmation | `false` |
| Idempotent | `false` |
| Emits | `[]` |
| Audit | `false` |
| Timeout | `3_000` |
| Calls | — |

### 3.17 `companies.updateShowcase`

| Field | Value |
| --- | --- |
| Name | `companies.updateShowcase` |
| Description | Update showcase configuration (sections, theme, SEO) |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ sections?: JsonSections, theme?: JsonTheme, seo?: JsonSeo }` |
| Output | Full `showcase_config` row |
| Permissions | `["showcase:edit"]` |
| aiExposure | `exposed` |
| risk | `write` |
| requiresConfirmation | `false` |
| Idempotent | `false` |
| Emits | `["companies.showcaseUpdated"]` |
| Audit | `true` |
| Audit target | `ctx.companyId` |
| Timeout | `5_000` |
| Calls | — |

### 3.18 `companies.updateSocials`

| Field | Value |
| --- | --- |
| Name | `companies.updateSocials` |
| Description | Set the company's social media links (replaces all) |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ socials: Array<{ platform: string, url: string }> }` (max 10) |
| Output | `Array<{ id, platform, url }>` |
| Permissions | `["showcase:edit"]` |
| aiExposure | `exposed` |
| risk | `write` |
| requiresConfirmation | `false` |
| Idempotent | `true` — same input produces same result |
| Emits | `["companies.socialsUpdated"]` |
| Audit | `true` |
| Audit target | `ctx.companyId` |
| Timeout | `5_000` |
| Calls | — |

**Behavior:**
- Replace-all semantics: delete existing rows, insert new set.
- Validates URL format for each entry.
- Platform values are free text (not an enum — allows new platforms without
  schema changes).

### 3.19 `companies.listMembers`

| Field | Value |
| --- | --- |
| Name | `companies.listMembers` |
| Description | List all members of the company |
| Principal | `staff` |
| Transport | `client` |
| Input | `{}` |
| Output | `Array<{ id, userId, role, permissions, userName, userEmail, userPhone, createdAt }>` |
| Permissions | `["team:view"]` |
| aiExposure | `exposed` |
| risk | `read` |
| requiresConfirmation | `false` |
| Idempotent | `false` |
| Emits | `[]` |
| Audit | `false` |
| Timeout | `3_000` |
| Calls | — |

### 3.20 `companies.updateMemberRole`

| Field | Value |
| --- | --- |
| Name | `companies.updateMemberRole` |
| Description | Change a team member's role |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ memberId: string, role: 'admin' | 'manager' | 'employee' }` |
| Output | `{ id, userId, role }` |
| Permissions | `["team:manage"]` |
| aiExposure | `exposed` |
| risk | `write` |
| requiresConfirmation | `false` |
| Idempotent | `true` — setting same role is a no-op |
| Emits | `["companies.memberRoleUpdated"]` |
| Audit | `true` |
| Audit target | `input.memberId` |
| Audit snapshot | `{ previousRole, newRole }` |
| Timeout | `5_000` |
| Calls | — |

**Behavior:**
- Cannot change the role of an owner (owners remain owners).
- Cannot change own role.
- Only owner/admin with `team:manage` permission may invoke.
- `owner` is not a valid target role in this action — ownership transfer is a
  separate future capability.

### 3.21 `companies.updateMemberPermissions`

| Field | Value |
| --- | --- |
| Name | `companies.updateMemberPermissions` |
| Description | Set per-member permission overrides |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ memberId: string, granted: string[], denied: string[] }` |
| Output | `{ id, userId, permissions }` |
| Permissions | `["team:manage"]` |
| aiExposure | `exposed` |
| risk | `write` |
| requiresConfirmation | `false` |
| Idempotent | `true` |
| Emits | `["companies.memberPermissionsUpdated"]` |
| Audit | `true` |
| Audit target | `input.memberId` |
| Timeout | `5_000` |
| Calls | — |

**Behavior:**
- Cannot modify owner permissions.
- Cannot modify own permissions.
- Validates all permission keys exist in the known permission catalog.
- A permission cannot appear in both `granted` and `denied`.

### 3.22 `companies.removeMember`

| Field | Value |
| --- | --- |
| Name | `companies.removeMember` |
| Description | Remove a member from the company team |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ memberId: string }` |
| Output | `{ success: true }` |
| Permissions | `["team:manage"]` |
| aiExposure | `exposed` |
| risk | `high` |
| requiresConfirmation | `true` |
| Confirmation summary | Returns member name, role, and assignment counts |
| Idempotent | `true` — removing a non-existent member returns success |
| Emits | `["companies.memberRemoved"]` |
| Audit | `true` |
| Audit target | `input.memberId` |
| Timeout | `5_000` |
| Calls | — |

**Behavior:**
- Cannot remove an owner.
- Cannot remove self (use `companies.leave` instead).

### 3.23 `companies.leave`

| Field | Value |
| --- | --- |
| Name | `companies.leave` |
| Description | Leave a company (self-remove from the team) |
| Principal | `staff` |
| Transport | `client` |
| Input | `{}` |
| Output | `{ success: true }` |
| Permissions | `[]` (any member can leave) |
| aiExposure | `exposed` |
| risk | `high` |
| requiresConfirmation | `true` |
| Confirmation summary | Returns company name and the user's role |
| Idempotent | `false` |
| Emits | `["companies.memberLeft"]` |
| Audit | `true` |
| Audit target | `ctx.userId` |
| Timeout | `5_000` |
| Calls | — |

**Behavior:**
- An owner cannot leave if they are the sole owner (invariant: at least one
  owner must remain). Returns a typed error.
- If there are multiple owners, the leaving owner is removed normally.

### 3.24 `companies.addMember`

| Field | Value |
| --- | --- |
| Name | `companies.addMember` |
| Description | Add a user to the company team by user ID |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ userId: string, role: 'admin' | 'manager' | 'employee' }` |
| Output | `{ id, userId, role, companyId }` |
| Permissions | `["team:invite"]` |
| aiExposure | `exposed` |
| risk | `write` |
| requiresConfirmation | `false` |
| Idempotent | `true` — if user is already a member, returns existing membership |
| Emits | `["companies.memberAdded"]` |
| Audit | `true` |
| Audit target | `input.userId` |
| Timeout | `5_000` |
| Calls | — |

**Behavior:**
- Validates the user exists.
- If the user is already a member, returns the existing membership without
  modifying it (idempotent).
- Cannot add a user as `owner` via this action.

### 3.25 `companies.checkSlugAvailability`

| Field | Value |
| --- | --- |
| Name | `companies.checkSlugAvailability` |
| Description | Check if a company slug is available |
| Principal | `account` |
| Transport | `client` |
| Input | `{ slug: string }` |
| Output | `{ available: boolean, suggestion?: string }` |
| Permissions | `[]` |
| aiExposure | `exposed` |
| risk | `read` |
| requiresConfirmation | `false` |
| Idempotent | `false` |
| Emits | `[]` |
| Audit | `false` |
| Timeout | `3_000` |
| Calls | — |

### 3.26 `companies.getForStaffRead`

| Field | Value |
| --- | --- |
| Name | `companies.getForStaffRead` |
| Description | Get company data for cross-module reads by other staff actions |
| Principal | `staff` |
| Transport | `internal` |
| Input | `{}` |
| Output | `{ id, name, slug, prefix, publicationStatus, legalInfo: {...} | null }` |
| Permissions | `[]` |
| aiExposure | `internal` |
| risk | `read` |
| requiresConfirmation | `false` |
| Idempotent | `false` |
| Emits | `[]` |
| Audit | `false` |
| Timeout | `3_000` |
| Calls | — |

**Purpose:** Other modules (e.g. `documents`, `orders`) use `ctx.call` to
read company data in a principal-compatible way (ADR-0015).

### 3.27 `companies.syncSearchProjection`

| Field | Value |
| --- | --- |
| Name | `companies.syncSearchProjection` |
| Description | System job: notify the search module of company data changes |
| Principal | `system` |
| Transport | `internal` |
| System scope | `tenant` (scoped to one company) |
| Input | `{ companyId: string, trigger: 'updated' | 'published' | 'unpublished' | 'archived' }` |
| Output | `{ success: true }` |
| Permissions | `[]` |
| aiExposure | `internal` |
| risk | `write` |
| requiresConfirmation | `false` |
| Idempotent | `true` |
| Emits | `[]` |
| Audit | `false` |
| Timeout | `10_000` |
| Calls | — |

**Behavior:** Invoked by event subscriptions to propagate company changes to
the search module's projections. The `search` module consumes `companies.*`
events and calls this or reads company data directly via its read-model grant.

---

## 4. Events

### 4.1 Emitted events

| Event | Payload | Version | Expected subscribers |
| --- | --- | --- | --- |
| `companies.created` | `{ companyId, ownerId, name, slug }` | 1 | `feature-flags` (init defaults), `search` (no-op until published) |
| `companies.updated` | `{ companyId, changedFields: string[] }` | 1 | `search` (update projection if published) |
| `companies.published` | `{ companyId, slug, name }` | 1 | `search` (add to projection) |
| `companies.unpublished` | `{ companyId }` | 1 | `search` (remove from projection) |
| `companies.archived` | `{ companyId }` | 1 | `search` (remove), `chat` (mark inactive), `notifications` (suppress) |
| `companies.restored` | `{ companyId }` | 1 | — (company returns unpublished, needs explicit publish) |
| `companies.legalInfoUpdated` | `{ companyId }` | 1 | `documents` (refresh requisites) |
| `companies.categoriesUpdated` | `{ companyId, categoryIds: string[] }` | 1 | `search` (update category facets) |
| `companies.showcaseUpdated` | `{ companyId }` | 1 | — |
| `companies.socialsUpdated` | `{ companyId }` | 1 | — |
| `companies.memberAdded` | `{ companyId, userId, role, memberId }` | 1 | `notifications` (welcome), `chat` (add participant) |
| `companies.memberRemoved` | `{ companyId, userId, memberId }` | 1 | `chat` (remove participant), `notifications` |
| `companies.memberLeft` | `{ companyId, userId, memberId }` | 1 | Same as memberRemoved |
| `companies.memberRoleUpdated` | `{ companyId, memberId, previousRole, newRole }` | 1 | — |
| `companies.memberPermissionsUpdated` | `{ companyId, memberId }` | 1 | — |

### 4.2 Consumed events

None. The `companies` module is a root module — it does not consume events
from other modules.

### 4.3 Read-model grants

| Grantee | Tables/columns | Access pattern |
| --- | --- | --- |
| `search` | `companies` (published rows: `id`, `name`, `slug`, `bio`, `city`, `area`, `keywords`, `publication_status`), `company_business_categories`, `business_categories` | Direct read for building FTS projection; filtered to `publication_status = 'published' AND archived_at IS NULL` |
| `analytics` | `companies` (`id`, `name`, `created_at`), `company_members` (counts) | Simple dashboard queries |

---

## 5. State machines and concurrency

### 5.1 Publication status

```
            ┌──────────┐
            │  draft   │ ← initial on create
            └────┬─────┘
                 │ publish (validates completeness)
                 ▼
            ┌──────────┐
     ┌──────│ published│◄─────────┐
     │      └────┬─────┘          │
     │           │ unpublish      │ publish
     │           ▼                │
     │      ┌────────────┐       │
     │      │ unpublished │───────┘
     │      └─────────────┘
     │
     │ archive (from any state → unpublished + archived_at set)
     ▼
  [archived: archived_at IS NOT NULL, publication_status = 'unpublished']
```

**Allowed transitions:**
- `draft` → `published` (via `companies.publish`)
- `published` → `unpublished` (via `companies.unpublish`)
- `unpublished` → `published` (via `companies.publish`)
- Any state → `unpublished` + archived (via `companies.archive`)
- Archived → `unpublished` non-archived (via `companies.restore`)

**Concurrency:** Publication state changes are serialized per company using
`SELECT ... FOR UPDATE` on the company row within the transaction. Two
simultaneous publish/unpublish calls: one wins, the other retries or no-ops
(idempotent actions).

### 5.2 Membership invariant: at least one owner

The "at least one owner" invariant is enforced at the application level in
the `removeMember`, `leave`, and `updateMemberRole` handlers. Before
executing:
- Count owners in the company.
- If the action would reduce owner count to zero, reject with a typed error.

No DB trigger — this is intentional (per blueprint §6; business logic in code,
not triggers).

### 5.3 Prefix uniqueness and generation

- Prefix is generated in application code (replacing the v1
  `set_company_prefix` trigger).
- Algorithm: uppercase first letters of words in the name, padded/truncated
  to 3 chars, with a numeric suffix if collision detected.
- Once the company is published, the prefix is frozen (subsequent name changes
  do not regenerate it).
- The UNIQUE constraint on `prefix` provides the final race guard.

---

## 6. Edge cases

| # | Case | Behavior | v1 source |
| --- | --- | --- | --- |
| 1 | Two users create companies with the same slug simultaneously | UNIQUE constraint causes one INSERT to fail; handler returns `SLUG_TAKEN` error | v1 `create_company_onboarding` RPC |
| 2 | User tries to create a third company as owner | Rejected with `MAX_COMPANIES_REACHED` (limit: 2 owned companies per user) | v1 `create_company_onboarding` check |
| 3 | Owner tries to leave when they are the sole owner | Rejected with `LAST_OWNER` error | v1 RLS policy `company_members: delete` excluded owners |
| 4 | Staff updates slug of a published company | Allowed; emits `companies.updated` so search/links update. Old slug becomes available immediately (no redirect table in V2 launch) | N/A (new in v2) |
| 5 | Consumer requests an unpublished company by ID | Returns `NotFoundError`; consumer actions always filter `publication_status = 'published'` | N/A (new in v2 via ADR-0018) |
| 6 | Archived company is accessed by existing CRM customer | CRM records remain; customer-principal actions on the company (view orders, chat) continue to work. Only discovery (consumer) and public profile are blocked | N/A (new in v2) |
| 7 | Publish attempted without business category | Returns `PUBLISH_PREREQUISITES_UNMET` error listing missing fields | N/A (new in v2) |
| 8 | Prefix collision during generation | Suffix numeric counter (e.g. `CMP`, `CMP2`, `CMP3`) until a unique value is found. Max 10 attempts before falling back to random 4-char alphanumeric | v1 `set_company_prefix` trigger (did not handle collisions — relied on name uniqueness) |
| 9 | Member removed while they have active chat assignments | `companies.memberRemoved` event triggers `chat` to reassign/unassign conversations | v1 trigger `conversations_update_assignment` |
| 10 | Legal info IBAN format invalid | Validation rejects with `INVALID_IBAN_FORMAT` before write | New (v1 had no validation) |
| 11 | Company with `publication_status = 'draft'` receives `unpublish` call | No-op (idempotent) — draft and unpublished are distinct states but unpublishing a draft is treated as already-not-published | N/A |

---

## 7. v1 migration notes

### 7.1 `companies` table

| v1 column | v2 column | Decision | Notes |
| --- | --- | --- | --- |
| `id` | `id` | KEEP | UUID, direct mapping |
| `name` | `name` | KEEP | |
| `email` | `email` | KEEP | |
| `phone` | `phone` | KEEP | |
| `slug` | `slug` | KEEP | Validated format preserved |
| `prefix` | `prefix` | KEEP | Add UNIQUE constraint (was not unique in v1) |
| `logo_url` | `logo_url` | KEEP | Path migrated to new S3 structure |
| `bio` | `bio` | KEEP | |
| `about_html` | `about_html` | KEEP | |
| `city` | `city` | KEEP | |
| `city_ref` | `city_ref` | KEEP | |
| `area` | `area` | KEEP | |
| `address` | `address` | KEEP | |
| `latitude` | — | DROP | Geo-radius discovery dropped (ADR-0018) |
| `longitude` | — | DROP | Same |
| `working_hours` | `working_hours` | KEEP | |
| `keywords` | `keywords` | KEEP | |
| `reviews_enabled` | — | DROP | Reviews/comments dropped |
| `products_count` | — | DROP | Denormalized counter; derived by catalog |
| `followers_count` | — | DROP | Social mechanics dropped |
| `orders_count` | — | DROP | Owned by orders module |
| `embedding` | — | DROP | Vector search dropped |
| `fts` | Expression index / search projection | TRANSFORM | Search module owns FTS projection; companies provides read-model grant and an expression GIN index |
| `created_at` | `created_at` | KEEP | |
| `updated_at` | `updated_at` | KEEP | |
| — | `publication_status` | ADD | New; migrated companies default to `'published'` (they were public in v1) |
| — | `published_at` | ADD | New; set to `created_at` for migrated companies |
| — | `archived_at` | ADD | New; NULL for all migrated companies |

**Data migration:** All existing v1 companies are migrated as `published`
(v1 had no publication state — all companies were publicly readable). The
`published_at` is set to the company's `created_at`.

**Reconciliation query:** Compare row count, id set, slug set, and prefix set
between v1 and v2 after migration.

### 7.2 `company_members` table

| v1 column | v2 column | Decision | Notes |
| --- | --- | --- | --- |
| `id` | `id` | KEEP | UUID |
| `company_id` | `company_id` | KEEP | FK remapped to v2 companies |
| `user_id` | `user_id` | TRANSFORM | Supabase `auth.users.id` → better-auth user ID (via user mapping table) |
| `role` | `role` | KEEP | Same CHECK constraint values |
| `permissions` | `permissions` | TRANSFORM | v1 `{}` default → v2 `{"granted":[],"denied":[]}` canonical shape; existing non-empty values are restructured |
| `created_at` | `created_at` | KEEP | |
| `updated_at` | `updated_at` | KEEP | |

**v1 RLS policies → v2 action mapping:**
- `company_members: select` → `companies.listMembers` (`team:view` permission)
- `company_members: insert` → `companies.addMember` (`team:invite` permission) + `companies.create` (first owner)
- `company_members: update` → `companies.updateMemberRole` / `companies.updateMemberPermissions` (`team:manage`)
- `company_members: delete` → `companies.removeMember` (`team:manage`)

**v1 functions → v2 mapping:**
- `is_company_owner()` → core principal factory verifies owner role
- `is_company_member()` → core staff context factory (membership load)
- `has_no_company_members()` → `companies.create` handler (first-member check)
- `has_company_permission()` → core permission resolution service (same algorithm in TypeScript)

### 7.3 `role_permission_defaults` table

| v1 column | v2 column | Decision | Notes |
| --- | --- | --- | --- |
| `role` | `role` | KEEP | Same values |
| `permission` | `permission` | KEEP | Permission keys may be renamed for consistency (e.g. `products:view` → same or mapped) |

**Migration:** Seed data is re-inserted via a migration with the v2 permission
catalog. V1 seed values are a starting template; v2 may add/rename permissions
as the module set changes.

### 7.4 `company_legal_info` table

| v1 column | v2 column | Decision | Notes |
| --- | --- | --- | --- |
| `id` | `id` | KEEP | |
| `company_id` | `company_id` | KEEP | |
| `company_type` | `company_type` | KEEP | Same CHECK (`fop`, `tov`) |
| `legal_name` | `legal_name` | KEEP | |
| `edrpou` | `edrpou` | KEEP | |
| `legal_address` | `legal_address` | KEEP | |
| `iban` | `iban` | KEEP | |
| `bank_name` | `bank_name` | KEEP | |
| `bank_mfo` | `bank_mfo` | KEEP | |
| `bank_edrpou` | `bank_edrpou` | KEEP | |
| `phone` | `phone` | KEEP | |
| `email` | `email` | KEEP | |
| `created_at` | `created_at` | KEEP | |
| `updated_at` | `updated_at` | KEEP | |

**v1 RLS → v2:**
- `company_legal_info: member select` → `companies.getLegalInfo` (`settings:payments`)
- `company_legal_info: member insert/update` → `companies.updateLegalInfo` (`settings:payments`)

**v1 function → v2:**
- `get_checkout_payment_info()` → `payments` module calls `companies.getForStaffRead` or the documents module reads legal info via `ctx.call("companies.getLegalInfo")`.
- `create_company_onboarding()` → `companies.create` action handler.

### 7.5 `company_socials` table

| v1 column | v2 column | Decision | Notes |
| --- | --- | --- | --- |
| `id` | `id` | KEEP | |
| `company_id` | `company_id` | KEEP | |
| `platform` | `platform` | KEEP | Free text |
| `url` | `url` | KEEP | |
| `created_at` | `created_at` | KEEP | |
| `updated_at` | `updated_at` | KEEP | |

**v1 RLS → v2:**
- `company_socials: public read` → `companies.getPublishedProfile` (public principal)
- `company_socials: member insert/update/delete` → `companies.updateSocials` (`showcase:edit`)

### 7.6 `showcase_config` table

| v1 column | v2 column | Decision | Notes |
| --- | --- | --- | --- |
| `id` | `id` | KEEP | |
| `company_id` | `company_id` | KEEP | |
| `sections` | `sections` | KEEP | Same JSON structure |
| `theme` | `theme` | KEEP | |
| `seo` | `seo` | KEEP | |
| `created_at` | `created_at` | KEEP | |
| `updated_at` | `updated_at` | KEEP | |

**v1 RLS → v2:**
- `showcase_config: public read` → included in `companies.getPublishedProfile`
- `showcase_config: member insert/update/delete` → `companies.updateShowcase` (`showcase:edit`)

### 7.7 `business_categories` table

| v1 column | v2 column | Decision | Notes |
| --- | --- | --- | --- |
| `id` | `id` | KEEP | |
| `slug` | `slug` | KEEP | |
| `name_en` | `name_en` | KEEP | |
| `name_uk` | `name_uk` | KEEP | |
| `icon` | `icon` | KEEP | |
| `display_order` | `display_order` | KEEP | |
| `is_active` | `is_active` | KEEP | |
| `created_at` | `created_at` | KEEP | |

**v1 RLS → v2:**
- `business_categories: public read` → `companies.listCategories` (consumer principal)

Seed data is carried over via migration (same 18 categories).

### 7.8 `company_business_categories` table

| v1 column | v2 column | Decision | Notes |
| --- | --- | --- | --- |
| `company_id` | `company_id` | KEEP | |
| `category_id` | `category_id` | KEEP | |

**v1 RLS → v2:**
- `company_business_categories: public read` → included in public/consumer profile reads
- `company_business_categories: member insert/delete` → `companies.updateCategories` (`showcase:edit`)

### 7.9 Triggers

| v1 trigger | v2 decision | Where behavior moves |
| --- | --- | --- |
| `set_companies_updated_at` | KEEP as DB technical trigger | `updated_at` auto-update |
| `company_members_update_timestamp` | KEEP as DB technical trigger | `updated_at` auto-update |
| `set_company_socials_updated_at` | KEEP as DB technical trigger | |
| `update_showcase_config_updated_at` | KEEP as DB technical trigger | |
| `company_legal_info_update_timestamp` | KEEP as DB technical trigger | |
| `assign_company_prefix` | MOVE to application code | `companies.create` handler generates prefix |
| `create_default_company_trigger` | MOVE to application code | `companies.create` handler creates default showcase, etc. |

### 7.10 Views

| v1 view | v2 decision | Notes |
| --- | --- | --- |
| `company_details` | DROP | Replaced by action read logic (joins in handler/service) |
| `public_profiles` | DROP | Replaced by `companies.getPublishedProfile` and consumer list actions |

### 7.11 Functions/RPCs

| v1 function | v2 decision | Where it moves |
| --- | --- | --- |
| `is_company_owner()` | DROP | Core principal factory |
| `is_company_member()` | DROP | Core staff context factory |
| `has_no_company_members()` | DROP | `companies.create` handler |
| `has_company_permission()` | DROP | Core permission resolution service |
| `set_company_prefix()` | DROP | `companies.create` handler |
| `haversine_km()` | DROP | Geo-radius discovery not carried |
| `create_company_onboarding()` | DROP | `companies.create` action |
| `get_public_profiles()` | DROP | `companies.getPublishedProfile` / consumer actions |
| `get_company_page()` | DROP | `companies.get` / `getPublishedProfile` |

---

## 8. Non-functional requirements

| Concern | Requirement |
| --- | --- |
| Rate limiting (consumer actions) | Per-user, max 60 req/min for list/search actions |
| Rate limiting (public profile) | Per-IP, max 30 req/min |
| Payload size | `about_html`: max 50 KB; `sections` JSON: max 100 KB; `keywords`: max 20 items |
| PII in logs | `email`, `phone`, legal info fields are NOT logged in structured logs. Audit records store the action and target, not the payload |
| Expected volumes | ~100–1000 companies at launch; ~1–50 members per company |
| Latency-sensitive | `getPublishedProfile` and consumer list actions: < 100ms p95 (indexed queries, no joins beyond socials/categories) |
| Maximum companies per user (as owner) | 2 |
| Maximum categories per company | 5 |
| Maximum socials per company | 10 |
| Maximum members per company | No hard limit (soft limit 100 for V2 launch) |

---

## 9. Acceptance criteria

### Mandatory (from template)

- [ ] Cross-tenant isolation: staff of company A cannot read/write company B's
      data via any staff action
- [ ] Cross-tenant isolation: consumer cannot access unpublished companies
- [ ] Cross-tenant isolation: account user A cannot restore/list user B's
      companies
- [ ] Mode-appropriate authorization denial:
  - Staff actions check `permissions` and deny with typed error
  - Public `getPublishedProfile` resolveTarget rejects unpublished/archived
  - Consumer actions filter to published-only (never surface unpublished)
  - Account actions verify ownership by membership lookup
- [ ] Consumer actions: contract check rejects `resolveTarget`; published-only
      access; no CRM creation/side effects; `audit: false` and `emits: []`;
      instantiate inherited `consumerIsolationSuite` from core.md §12
- [ ] Validation failure surfaces typed errors (not generic 500)
- [ ] Output validates at runtime and is JSON-safe
- [ ] Idempotency behavior where declared (publish/unpublish/archive/restore
      are safe to retry)
- [ ] Declared events are emitted transactionally (outbox)
- [ ] Audit records written for `audit: true` actions

### Module-specific

- [ ] Company creation atomically creates company + owner membership +
      default showcase config in one transaction
- [ ] Slug uniqueness enforced at DB level; concurrent creation returns typed
      error
- [ ] Prefix generation produces a UNIQUE value; published companies have
      frozen prefixes
- [ ] Publication lifecycle: draft → published requires minimum profile
      completeness (name, slug, ≥1 category); publish validates and rejects
      with field-level errors
- [ ] At least one owner invariant: leave/remove/role-change cannot reduce
      owner count to zero
- [ ] Permission resolution matches v1 algorithm:
      owner → all; deny → false; grant → true; role default → lookup
- [ ] `listMyCompanies` returns all companies where user has a membership
      (including archived if `includeArchived = true`)
- [ ] Legal info upsert validates IBAN format (UA + 27 digits) and EDRPOU
      (8–10 digits)
- [ ] Showcase/socials/categories are accessible in the public profile only
      when the company is published
- [ ] Archived companies are excluded from consumer discovery and public
      profile resolution
- [ ] Business category seed data (18 categories) is loaded by migration
- [ ] Read-model grant: `search` module can directly query published company
      rows and their categories without going through an action

---

## Changelog

| Date | Change | Why | Reported by |
| --- | --- | --- | --- |
| 2026-08-17 | Initial full spec (extends companies-foundation.md; full module scope applies from Phase 2 onward; Phase 0 implements only the foundation slice) | Spec-rework queue Step 3; deliver complete companies module specification | Human owner |
