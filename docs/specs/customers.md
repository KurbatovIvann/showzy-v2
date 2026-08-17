# Spec: customers

> Status: Draft.
> Written against blueprint §2.1, §4, §5; scope §2, §7 (phases 2, 5);
> ADR-0013, ADR-0014, ADR-0015, ADR-0016, ADR-0018;
> `docs/specs/core.md`, `docs/specs/db.md`, `docs/specs/contract.md`,
> `docs/specs/pricing.md`, `docs/specs/chat.md`;
> `docs/module-ownership.md`, `docs/reference/v1-migration-matrix.md`.

## 1. Purpose

The `customers` module owns **company-scoped CRM customer records** (the link
between a platform user and a company), **customer groups** (used for
segmentation and group-based pricing), and **customer legal profiles** (B2B
legal entity details used by the documents module for counterparty requisites).

It explicitly does NOT own: user identity/auth (better-auth), company
membership/RBAC (`companies`), invite tokens/redemption (`invites`), price
lists or personal prices (`pricing`), orders or order items (`orders`),
conversations (`chat`), document counterparty snapshots (`documents`), or
global consumer discovery (`search`). The module does NOT create CRM records as
a side effect of discovery, profile browsing, cart interaction, or chat
(ADR-0018).

CRM records are created only by:
- a staff member manually adding the customer, or
- the checkout/order-creation action atomically linking or creating the record
  via the system-principal `customers.ensureCrmRecord` action.

## 2. Owned tables

All tables in `packages/db/src/schema/customers.ts` (ADR-0014).

### 2.1 `company_customers`

The CRM record linking a platform user to a company. One user may have CRM
records in many companies; one company may have many customers.

| Column | Type | Constraints / default | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `company_id` | `uuid NOT NULL` | FK → `companies.id` `ON DELETE CASCADE` | Tenant root |
| `user_id` | `uuid` | Nullable; FK → better-auth users `ON DELETE SET NULL` | Link to platform account. NULL = unlinked CRM-only record (staff-added without a matching account) |
| `group_id` | `uuid` | Nullable; FK → `customer_groups.id` `ON DELETE SET NULL` | Group assignment for segmentation/pricing |
| `price_list_id` | `uuid` | Nullable; FK → `price_lists.id` `ON DELETE SET NULL` | Cross-module FK (pricing); direct price list assignment |
| `name` | `text NOT NULL` | | Display name in the CRM |
| `phone` | `text` | Nullable | Contact phone (copied from user profile or entered by staff) |
| `email` | `text` | Nullable | Contact email (same) |
| `notes` | `text` | Nullable | Staff-only internal notes |
| `created_at` | `timestamptz` | Default `now()` | |
| `updated_at` | `timestamptz` | Default `now()`, trigger-maintained | |

**Indexes:**

- Unique `(company_id, user_id) WHERE user_id IS NOT NULL` — one CRM record
  per user per company; partial to allow multiple NULL-user rows.
- `(company_id)` — tenant-scoped list queries.
- `(company_id, phone) WHERE user_id IS NULL` — phone matching for unlinked
  records during checkout CRM creation.
- `(company_id, email) WHERE user_id IS NULL` — email matching for same.
- `(group_id)` — group membership lookups.
- `(user_id) WHERE user_id IS NOT NULL` — cross-company lookups for
  customer-principal target resolution.
- `(company_id, name)` — alphabetical list sort.

### 2.2 `customer_groups`

Segmentation groups with optional price list assignment.

| Column | Type | Constraints / default | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `company_id` | `uuid NOT NULL` | FK → `companies.id` `ON DELETE CASCADE` | Tenant root |
| `price_list_id` | `uuid` | Nullable; FK → `price_lists.id` `ON DELETE SET NULL` | Cross-module FK (pricing); group pricing tier |
| `name` | `text NOT NULL` | | Human-readable group name |
| `slug` | `text NOT NULL` | Unique `(company_id, slug)` | Machine-stable identifier |
| `description` | `text` | Nullable | |
| `sort_order` | `integer` | Default `0` | Display ordering |
| `created_at` | `timestamptz` | Default `now()` | |
| `updated_at` | `timestamptz` | Default `now()`, trigger-maintained | |

**Indexes:**

- Unique `(company_id, slug)` — natural composite key.
- `(company_id, sort_order)` — ordered list queries.

### 2.3 `customer_legal_profiles`

B2B customer legal entity details, owned by the customer (user-scoped, not
company-scoped). One per user. Used by the documents module for counterparty
requisites.

| Column | Type | Constraints / default | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `user_id` | user id type | `NOT NULL UNIQUE`; FK → better-auth users `ON DELETE CASCADE` | One-to-one with user |
| `entity_type` | `text NOT NULL` | Default `'fop'`, CHECK `IN ('fop', 'tov')` | `fop` = sole proprietor, `tov` = LLC |
| `legal_name` | `text` | Nullable | Official legal name |
| `edrpou` | `text` | Nullable | ЄДРПОУ or ІПН tax identifier (8–10 digits) |
| `legal_address` | `text` | Nullable | Legal/registration address |
| `iban` | `text` | Nullable | Bank account IBAN |
| `bank_name` | `text` | Nullable | Bank name |
| `bank_mfo` | `text` | Nullable | Bank MFO routing code (6 digits) |
| `phone` | `text` | Nullable | Business phone (may differ from user profile) |
| `email` | `text` | Nullable | Business email |
| `created_at` | `timestamptz` | Default `now()` | |
| `updated_at` | `timestamptz` | Default `now()`, trigger-maintained | |

**Indexes:**

- Unique `(user_id)` — enforced by column constraint.

### 2.4 `counterparties`

Company-scoped business partner records for document generation. Links to a
CRM customer when one exists; otherwise stores standalone legal requisites
(e.g., a supplier who is not a customer).

| Column | Type | Constraints / default | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `company_id` | `uuid NOT NULL` | FK → `companies.id` `ON DELETE CASCADE` | Tenant root |
| `customer_id` | `uuid` | Nullable; FK → `company_customers.id` `ON DELETE SET NULL` | CRM link |
| `user_id` | `uuid` | Nullable; FK → better-auth users `ON DELETE SET NULL` | Platform user link |
| `name` | `text NOT NULL` | | Official legal name |
| `edrpou` | `text` | Nullable | ЄДРПОУ or ІПН |
| `legal_address` | `text` | Nullable | |
| `iban` | `text` | Nullable | |
| `bank_name` | `text` | Nullable | |
| `bank_mfo` | `text` | Nullable | |
| `phone` | `text` | Nullable | |
| `email` | `text` | Nullable | |
| `notes` | `text` | Nullable | |
| `created_at` | `timestamptz` | Default `now()` | |
| `updated_at` | `timestamptz` | Default `now()`, trigger-maintained | |

**Indexes:**

- Unique `(company_id, edrpou) WHERE edrpou IS NOT NULL` — one counterparty
  per EDRPOU per company.
- `(company_id)` — tenant-scoped list.
- `(customer_id) WHERE customer_id IS NOT NULL` — customer-to-counterparty
  lookup.

### 2.5 Not owned (explicit boundary)

| Data | Owner | How customers interacts |
| --- | --- | --- |
| User identity/profile | better-auth (`packages/db`) | Read user facts during CRM creation |
| Price lists | `pricing` | `price_list_id` FK on `company_customers` and `customer_groups`; pricing calls `customers.getCustomerPricingFacts` |
| Orders | `orders` | Orders calls `customers.ensureCrmRecord` at checkout |
| Chat conversations | `chat` | Chat reads `company_customer_id`; customers exposes fact reads |
| Invite tokens | `invites` | Invites consumes customer events or calls customer reads |

## 3. Actions

Shared output types:

```ts
const CompanyCustomer = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  userId: z.string().nullable(),
  groupId: z.string().uuid().nullable(),
  priceListId: z.string().uuid().nullable(),
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const CustomerGroup = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  priceListId: z.string().uuid().nullable(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  sortOrder: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const CustomerLegalProfile = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  entityType: z.enum(["fop", "tov"]),
  legalName: z.string().nullable(),
  edrpou: z.string().nullable(),
  legalAddress: z.string().nullable(),
  iban: z.string().nullable(),
  bankName: z.string().nullable(),
  bankMfo: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const Counterparty = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  customerId: z.string().uuid().nullable(),
  userId: z.string().nullable(),
  name: z.string(),
  edrpou: z.string().nullable(),
  legalAddress: z.string().nullable(),
  iban: z.string().nullable(),
  bankName: z.string().nullable(),
  bankMfo: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
```

---

### 3.1 Staff actions (CRM management)

All staff actions: `principal: staff`, `transport: client`,
`requiresConfirmation: false` (unless stated), tenant scope from verified
membership. Reads: `risk: read`, `aiExposure: exposed`, `idempotent: false`,
`emits: []`, `audit: false`, timeout `2_000`. Writes: `risk: write`,
`aiExposure: exposed`, `idempotent: true` (client key, scope
`company:<companyId>`, conflict per core.md §5), `audit: true`, timeout
`5_000`.

#### `customers.createCustomer`

| Field | Value |
| --- | --- |
| Name | `customers.createCustomer` |
| Description | Add a new customer to this company's CRM. If a userId is provided, links the customer to an existing platform account (idempotent on the unique company+user pair). |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ name: z.string().min(1).max(200), phone: z.string().max(30).optional(), email: z.string().email().max(200).optional(), notes: z.string().max(2000).optional(), userId: z.string().uuid().optional(), groupId: z.string().uuid().optional(), priceListId: z.string().uuid().optional() }` |
| Output | `CompanyCustomer` |
| Permissions | `["customers:create"]` |
| aiExposure | `exposed` |
| risk | `write` |
| requiresConfirmation | `false` |
| idempotent | `true` — key: client-supplied; scope: `company:<companyId>`; conflict: same key + different input → `IdempotencyConflictError`. When `userId` is supplied and a record for that user+company already exists, returns the existing record (domain idempotency via unique constraint) |
| emits | `["customers.created"]` |
| audit | `true` |
| auditTarget | `{ type: "company_customer", id: <created/existing id> }` |
| timeout | `5_000` |
| Calls (`ctx.call`) | none |

Validation: at least one of `phone`, `email`, or `userId` must be provided.
If `groupId` is specified, it must belong to this company. If `priceListId`
is specified, it must exist (cross-module FK validated by the DB constraint;
the handler does not call pricing — the FK suffices). If `userId` is provided
and a CRM record already exists for this user+company, the action returns
the existing record without modification (domain-level idempotency).

#### `customers.updateCustomer`

| Field | Value |
| --- | --- |
| Name | `customers.updateCustomer` |
| Description | Update a CRM customer record's name, contact details, notes, group, or price list assignment. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ customerId: z.string().uuid(), name: z.string().min(1).max(200).optional(), phone: z.string().max(30).nullable().optional(), email: z.string().email().max(200).nullable().optional(), notes: z.string().max(2000).nullable().optional(), groupId: z.string().uuid().nullable().optional(), priceListId: z.string().uuid().nullable().optional() }` |
| Output | `CompanyCustomer` |
| Permissions | `["customers:edit"]` |
| aiExposure | `exposed` |
| risk | `write` |
| idempotent | `true` — key: client-supplied; scope: `company:<companyId>` |
| emits | `["customers.updated"]` |
| audit | `true` |
| auditTarget | `{ type: "company_customer", id: input.customerId }` |
| timeout | `5_000` |

#### `customers.deleteCustomer`

| Field | Value |
| --- | --- |
| Name | `customers.deleteCustomer` |
| Description | Delete a CRM customer record. This removes pricing assignments and unlinks the customer from conversations. Orders are preserved (they snapshot customer details). |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ customerId: z.string().uuid() }` |
| Output | `{ deleted: z.literal(true) }` |
| Permissions | `["customers:delete"]` |
| aiExposure | `exposed` |
| risk | `high` |
| requiresConfirmation | `true` |
| confirmationSummary | Returns customer name, linked order count (via `ctx.call orders.getCustomerOrderCount`), active conversation status, and personal price count. |
| idempotent | `true` — key: client-supplied; replay if already deleted returns `{ deleted: true }` |
| emits | `["customers.deleted"]` |
| audit | `true` |
| auditTarget | `{ type: "company_customer", id: input.customerId }` |
| timeout | `5_000` |
| Calls (`ctx.call`) | `orders.getCustomerOrderCount` (in confirmation summary) |

#### `customers.listCustomers`

| Field | Value |
| --- | --- |
| Name | `customers.listCustomers` |
| Description | List CRM customers for this company with cursor-based pagination, optional text search (name/phone/email), and optional group filter. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ cursor: z.string().uuid().optional(), limit: z.number().int().min(1).max(100).optional().default(50), search: z.string().max(100).optional(), groupId: z.string().uuid().optional() }` |
| Output | `{ customers: z.array(CompanyCustomer), nextCursor: z.string().uuid().nullable() }` |
| Permissions | `["customers:view"]` |
| aiExposure | `exposed` |
| risk | `read` |
| idempotent | `false` |
| emits | `[]` |
| audit | `false` |
| timeout | `3_000` |

#### `customers.getCustomer`

| Field | Value |
| --- | --- |
| Name | `customers.getCustomer` |
| Description | Get a single CRM customer record by ID. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ customerId: z.string().uuid() }` |
| Output | `CompanyCustomer` |
| Permissions | `["customers:view"]` |
| aiExposure | `exposed` |
| risk | `read` |
| idempotent | `false` |
| emits | `[]` |
| audit | `false` |
| timeout | `2_000` |

---

### 3.2 Staff actions (groups)

#### `customers.createGroup`

| Field | Value |
| --- | --- |
| Name | `customers.createGroup` |
| Description | Create a customer group for segmentation and optional group-based pricing. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ name: z.string().min(1).max(200), slug: z.string().min(1).max(50).regex(/^[a-z0-9_-]+$/), description: z.string().max(1000).optional(), priceListId: z.string().uuid().optional(), sortOrder: z.number().int().optional().default(0) }` |
| Output | `CustomerGroup` |
| Permissions | `["customers:edit"]` |
| aiExposure | `exposed` |
| risk | `write` |
| idempotent | `true` — key: client-supplied; scope: `company:<companyId>` |
| emits | `[]` |
| audit | `true` |
| auditTarget | `{ type: "customer_group", id: <created id> }` |
| timeout | `5_000` |

#### `customers.updateGroup`

| Field | Value |
| --- | --- |
| Name | `customers.updateGroup` |
| Description | Update a customer group's name, slug, description, price list, or sort order. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ groupId: z.string().uuid(), name: z.string().min(1).max(200).optional(), slug: z.string().min(1).max(50).regex(/^[a-z0-9_-]+$/).optional(), description: z.string().max(1000).nullable().optional(), priceListId: z.string().uuid().nullable().optional(), sortOrder: z.number().int().optional() }` |
| Output | `CustomerGroup` |
| Permissions | `["customers:edit"]` |
| aiExposure | `exposed` |
| risk | `write` |
| idempotent | `true` — key: client-supplied; scope: `company:<companyId>` |
| emits | `[]` |
| audit | `true` |
| auditTarget | `{ type: "customer_group", id: input.groupId }` |
| timeout | `5_000` |

#### `customers.deleteGroup`

| Field | Value |
| --- | --- |
| Name | `customers.deleteGroup` |
| Description | Delete a customer group. Customers in this group will have their group_id set to NULL (ON DELETE SET NULL). |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ groupId: z.string().uuid() }` |
| Output | `{ deleted: z.literal(true) }` |
| Permissions | `["customers:edit"]` |
| aiExposure | `exposed` |
| risk | `write` |
| requiresConfirmation | `false` |
| idempotent | `true` — key: client-supplied; replay if already deleted returns `{ deleted: true }` |
| emits | `[]` |
| audit | `true` |
| auditTarget | `{ type: "customer_group", id: input.groupId }` |
| timeout | `5_000` |

#### `customers.listGroups`

| Field | Value |
| --- | --- |
| Name | `customers.listGroups` |
| Description | List all customer groups for this company, ordered by sort order then name. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{}` |
| Output | `{ groups: z.array(CustomerGroup) }` |
| Permissions | `["customers:view"]` |
| aiExposure | `exposed` |
| risk | `read` |
| idempotent | `false` |
| emits | `[]` |
| audit | `false` |
| timeout | `2_000` |

#### `customers.getGroup`

| Field | Value |
| --- | --- |
| Name | `customers.getGroup` |
| Description | Get a single customer group by ID. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ groupId: z.string().uuid() }` |
| Output | `CustomerGroup` |
| Permissions | `["customers:view"]` |
| aiExposure | `exposed` |
| risk | `read` |
| idempotent | `false` |
| emits | `[]` |
| audit | `false` |
| timeout | `2_000` |

---

### 3.3 Staff actions (counterparties)

#### `customers.createCounterparty`

| Field | Value |
| --- | --- |
| Name | `customers.createCounterparty` |
| Description | Create a counterparty (business partner) record for document generation. Optionally links to a CRM customer. Idempotent on company+EDRPOU when EDRPOU is provided. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ name: z.string().min(1).max(300), edrpou: z.string().max(10).optional(), legalAddress: z.string().max(500).optional(), iban: z.string().max(34).optional(), bankName: z.string().max(200).optional(), bankMfo: z.string().max(6).optional(), phone: z.string().max(30).optional(), email: z.string().email().max(200).optional(), notes: z.string().max(2000).optional(), customerId: z.string().uuid().optional() }` |
| Output | `Counterparty` |
| Permissions | `["customers:edit"]` |
| aiExposure | `exposed` |
| risk | `write` |
| idempotent | `true` — key: client-supplied; scope: `company:<companyId>`. Domain idempotency: when `edrpou` is provided and a counterparty with the same company+edrpou exists, returns a conflict error (not silent upsert) |
| emits | `[]` |
| audit | `true` |
| auditTarget | `{ type: "counterparty", id: <created id> }` |
| timeout | `5_000` |

#### `customers.updateCounterparty`

| Field | Value |
| --- | --- |
| Name | `customers.updateCounterparty` |
| Description | Update a counterparty's legal details. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ counterpartyId: z.string().uuid(), name: z.string().min(1).max(300).optional(), edrpou: z.string().max(10).nullable().optional(), legalAddress: z.string().max(500).nullable().optional(), iban: z.string().max(34).nullable().optional(), bankName: z.string().max(200).nullable().optional(), bankMfo: z.string().max(6).nullable().optional(), phone: z.string().max(30).nullable().optional(), email: z.string().email().max(200).nullable().optional(), notes: z.string().max(2000).nullable().optional(), customerId: z.string().uuid().nullable().optional() }` |
| Output | `Counterparty` |
| Permissions | `["customers:edit"]` |
| aiExposure | `exposed` |
| risk | `write` |
| idempotent | `true` — key: client-supplied; scope: `company:<companyId>` |
| emits | `[]` |
| audit | `true` |
| auditTarget | `{ type: "counterparty", id: input.counterpartyId }` |
| timeout | `5_000` |

#### `customers.deleteCounterparty`

| Field | Value |
| --- | --- |
| Name | `customers.deleteCounterparty` |
| Description | Delete a counterparty record. Fails if the counterparty is referenced by existing documents (RESTRICT). |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ counterpartyId: z.string().uuid() }` |
| Output | `{ deleted: z.literal(true) }` |
| Permissions | `["customers:edit"]` |
| aiExposure | `exposed` |
| risk | `write` |
| idempotent | `true` — key: client-supplied; replay if already deleted returns `{ deleted: true }` |
| emits | `[]` |
| audit | `true` |
| auditTarget | `{ type: "counterparty", id: input.counterpartyId }` |
| timeout | `5_000` |

#### `customers.listCounterparties`

| Field | Value |
| --- | --- |
| Name | `customers.listCounterparties` |
| Description | List counterparties for this company with optional text search and cursor pagination. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ cursor: z.string().uuid().optional(), limit: z.number().int().min(1).max(100).optional().default(50), search: z.string().max(100).optional(), customerId: z.string().uuid().optional() }` |
| Output | `{ counterparties: z.array(Counterparty), nextCursor: z.string().uuid().nullable() }` |
| Permissions | `["customers:view"]` |
| aiExposure | `exposed` |
| risk | `read` |
| idempotent | `false` |
| emits | `[]` |
| audit | `false` |
| timeout | `3_000` |

#### `customers.getCounterparty`

| Field | Value |
| --- | --- |
| Name | `customers.getCounterparty` |
| Description | Get a single counterparty by ID. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ counterpartyId: z.string().uuid() }` |
| Output | `Counterparty` |
| Permissions | `["customers:view"]` |
| aiExposure | `exposed` |
| risk | `read` |
| idempotent | `false` |
| emits | `[]` |
| audit | `false` |
| timeout | `2_000` |

---

### 3.4 Customer actions (own profile reads)

All customer actions: `principal: customer`, `transport: client`,
`permissions: []`, authorization = typed `resolveTarget` (ADR-0013).

#### `customers.getMyCustomerRecord`

| Field | Value |
| --- | --- |
| Name | `customers.getMyCustomerRecord` |
| Description | Get your own CRM record at a specific company. Returns null-body NotFoundError if no CRM record exists. |
| Principal | `customer` |
| Transport | `client` |
| Target | Typed `resolveTarget` loads the `company_customers` row by `(company_id, user_id)` from `input.companyId` + authenticated `userId`; returns `{ companyId, resource: { customerId } }`. `NotFoundError` if no record exists. |
| Input | `{ companyId: z.string().uuid() }` |
| Output | `CompanyCustomer.omit({ notes: true })` (notes are staff-only) |
| Permissions | `[]` |
| aiExposure | `exposed` |
| risk | `read` |
| requiresConfirmation | `false` |
| idempotent | `false` |
| emits | `[]` |
| audit | `false` |
| timeout | `2_000` |
| Calls (`ctx.call`) | none |

#### `customers.getMyLegalProfile`

| Field | Value |
| --- | --- |
| Name | `customers.getMyLegalProfile` |
| Description | Get your own legal profile (FOP/TOV requisites). Returns NotFoundError if no profile exists yet. |
| Principal | `customer` |
| Transport | `client` |
| Target | Typed `resolveTarget`: the action is not company-scoped per se (legal profile is per-user), but needs a company context to ensure it's called from a company cabinet. Resolves via `input.companyId` proving company exists and user has a CRM record. Returns `{ companyId, resource: { userId: ctx.userId } }`. |
| Input | `{ companyId: z.string().uuid() }` |
| Output | `CustomerLegalProfile` |
| Permissions | `[]` |
| aiExposure | `exposed` |
| risk | `read` |
| idempotent | `false` |
| emits | `[]` |
| audit | `false` |
| timeout | `2_000` |

#### `customers.upsertMyLegalProfile`

| Field | Value |
| --- | --- |
| Name | `customers.upsertMyLegalProfile` |
| Description | Create or update your own legal profile (FOP/TOV requisites for B2B documents). |
| Principal | `customer` |
| Transport | `client` |
| Target | Same as `getMyLegalProfile`. |
| Input | `{ companyId: z.string().uuid(), entityType: z.enum(["fop", "tov"]), legalName: z.string().max(300).optional(), edrpou: z.string().max(10).optional(), legalAddress: z.string().max(500).optional(), iban: z.string().max(34).optional(), bankName: z.string().max(200).optional(), bankMfo: z.string().max(6).optional(), phone: z.string().max(30).optional(), email: z.string().email().max(200).optional() }` |
| Output | `CustomerLegalProfile` |
| Permissions | `[]` |
| aiExposure | `exposed` |
| risk | `write` |
| idempotent | `true` — key: client-supplied; scope: `user:<userId>`. Upsert on unique `(user_id)`. |
| emits | `[]` |
| audit | `true` |
| auditTarget | `{ type: "customer_legal_profile", id: <upserted id> }` |
| timeout | `5_000` |

---

### 3.5 System actions (checkout CRM link/create)

#### `customers.ensureCrmRecord`

| Field | Value |
| --- | --- |
| Name | `customers.ensureCrmRecord` |
| Description | Atomically ensure a CRM record exists for this user at this company. If a record already exists (matched by user_id, or by phone/email for unlinked records), returns it. If not, creates one. Called by the orders module during checkout — never fails the parent transaction. |
| Principal | `system` |
| Transport | `internal` |
| System scope | `tenant` (companyId from the calling context) |
| Input | `{ userId: z.string().uuid(), companyId: z.string().uuid(), name: z.string().min(1).max(200), phone: z.string().max(30).optional(), email: z.string().email().max(200).optional() }` |
| Output | `{ customerId: z.string().uuid(), created: z.boolean() }` |
| Permissions | `[]` |
| aiExposure | `internal` |
| risk | `write` |
| requiresConfirmation | `false` |
| idempotent | `true` — domain-level: unique `(company_id, user_id)` constraint; same user+company always returns the same record. Key: the delivering event ID or caller idempotency key via `event_deliveries` or `idempotency_keys`. |
| emits | `["customers.created"]` (only when a new record is created) |
| audit | `true` |
| auditTarget | `{ type: "company_customer", id: <existing or created id> }` |
| timeout | `5_000` |
| Calls (`ctx.call`) | none |

**Matching algorithm** (mirrors v1 `create_order_secure` logic):

1. Check `company_customers` for `(company_id, user_id)` — if found, return
   it (`created: false`).
2. If `phone` is provided and `user_id IS NULL` records exist with matching
   `(company_id, phone)`, link the first match by setting `user_id` on that
   row, update name/email. Return it (`created: false`).
3. Same for `email` if phone didn't match.
4. Otherwise, insert a new row with `user_id`, `name`, `phone`, `email`.
   Return it (`created: true`).

This action never throws a domain error that would abort the checkout
transaction. Constraint violations on the unique index are handled by
retrying as a read (conflict = record was created concurrently).

---

### 3.6 Cross-module read actions (composition targets)

These are `risk: read` actions exposed for `ctx.call` by other modules
(ADR-0015). Not directly exposed to clients.

#### `customers.getCustomerPricingFacts`

| Field | Value |
| --- | --- |
| Name | `customers.getCustomerPricingFacts` |
| Description | Internal read: return pricing-relevant facts for a CRM customer (price list, group, group price list). Used by the pricing module's resolution chain. |
| Principal | `staff` |
| Transport | `internal` |
| Input | `{ customerId: z.string().uuid() }` |
| Output | `{ customerId: z.string().uuid(), companyId: z.string().uuid(), priceListId: z.string().uuid().nullable(), groupId: z.string().uuid().nullable(), groupPriceListId: z.string().uuid().nullable() }` |
| Permissions | `["customers:view"]` |
| aiExposure | `internal` |
| risk | `read` |
| idempotent | `false` |
| emits | `[]` |
| audit | `false` |
| timeout | `2_000` |

Loads the customer row + joined group row (for `group.price_list_id`) in one
query. Verifies the customer belongs to the caller's company (staff context
provides `companyId`). Returns `NotFoundError` if the customer does not exist
or belongs to another company (no existence leak).

#### `customers.getCustomerPricingFactsForUser`

| Field | Value |
| --- | --- |
| Name | `customers.getCustomerPricingFactsForUser` |
| Description | Internal read: return pricing-relevant facts for a customer identified by userId+companyId. Used by pricing resolution when called from a customer-principal context. |
| Principal | `customer` |
| Transport | `internal` |
| Target | Typed `resolveTarget`: loads company_customers by `(company_id, user_id)` from input. Returns `{ companyId, resource: { customerId } }`. |
| Input | `{ companyId: z.string().uuid() }` |
| Output | `{ customerId: z.string().uuid(), companyId: z.string().uuid(), priceListId: z.string().uuid().nullable(), groupId: z.string().uuid().nullable(), groupPriceListId: z.string().uuid().nullable() }` |
| Permissions | `[]` |
| aiExposure | `internal` |
| risk | `read` |
| idempotent | `false` |
| emits | `[]` |
| audit | `false` |
| timeout | `2_000` |

#### `customers.getCustomerOrderFacts`

| Field | Value |
| --- | --- |
| Name | `customers.getCustomerOrderFacts` |
| Description | Internal read: return display facts for a CRM customer (name, userId). Used by chat for conversation hydration and by orders for customer snapshots. Supports batch (up to 50 IDs). |
| Principal | `staff` |
| Transport | `internal` |
| Input | `{ customerIds: z.array(z.string().uuid()).min(1).max(50) }` |
| Output | `{ customers: z.array(z.object({ customerId: z.string().uuid(), userId: z.string().nullable(), name: z.string(), phone: z.string().nullable(), email: z.string().nullable() })) }` |
| Permissions | `["customers:view"]` |
| aiExposure | `internal` |
| risk | `read` |
| idempotent | `false` |
| emits | `[]` |
| audit | `false` |
| timeout | `2_000` |

Returns only customers belonging to the caller's company (others are silently
excluded from the result array, not errored — batch semantics).

#### `customers.getCustomerForCheckout`

| Field | Value |
| --- | --- |
| Name | `customers.getCustomerForCheckout` |
| Description | Internal read: check if a CRM record exists for a user at a company. Used by orders at checkout to decide whether to call ensureCrmRecord. |
| Principal | `system` |
| Transport | `internal` |
| System scope | `tenant` |
| Input | `{ userId: z.string().uuid(), companyId: z.string().uuid() }` |
| Output | `{ exists: z.boolean(), customerId: z.string().uuid().nullable() }` |
| Permissions | `[]` |
| aiExposure | `internal` |
| risk | `read` |
| idempotent | `false` |
| emits | `[]` |
| audit | `false` |
| timeout | `2_000` |

#### `customers.getCounterpartyForDocument`

| Field | Value |
| --- | --- |
| Name | `customers.getCounterpartyForDocument` |
| Description | Internal read: return counterparty requisites for document generation. Used by the documents module to snapshot counterparty details. |
| Principal | `staff` |
| Transport | `internal` |
| Input | `{ counterpartyId: z.string().uuid() }` |
| Output | `Counterparty` |
| Permissions | `["customers:view"]` |
| aiExposure | `internal` |
| risk | `read` |
| idempotent | `false` |
| emits | `[]` |
| audit | `false` |
| timeout | `2_000` |

#### `customers.getCustomerLegalProfileForDocument`

| Field | Value |
| --- | --- |
| Name | `customers.getCustomerLegalProfileForDocument` |
| Description | Internal read: return a customer's legal profile by userId. Used by documents for B2B requisite snapshots. |
| Principal | `staff` |
| Transport | `internal` |
| Input | `{ userId: z.string().uuid() }` |
| Output | `CustomerLegalProfile.nullable()` (null if the user has no legal profile) |
| Permissions | `["customers:view"]` |
| aiExposure | `internal` |
| risk | `read` |
| idempotent | `false` |
| emits | `[]` |
| audit | `false` |
| timeout | `2_000` |

## 4. Events

### 4.1 Emitted

All envelope version `1`, `scope: "tenant"`, aggregate
`{ type: "company_customer", id: customerId }`.

| Event | Payload | Expected subscribers |
| --- | --- | --- |
| `customers.created` | `{ customerId, companyId, userId: nullable, name, phone: nullable, email: nullable, groupId: nullable, createdBy: "staff"\|"system" }` | `chat` (attach `company_customer_id` to existing conversation if one exists for this user+company); `analytics`; `search` (if customer search projections are needed) |
| `customers.updated` | `{ customerId, companyId, changes: string[] }` | `analytics` |
| `customers.deleted` | `{ customerId, companyId }` | `chat` (SET NULL on conversation.company_customer_id is handled by FK); `analytics` |

### 4.2 Consumed

| Event | Consumer | Bound action |
| --- | --- | --- |
| `invites.accepted` | `customers.invite-crm-linker` | Internal system action that attaches `company_customer_id` to an existing CRM record or is a no-op if the invite flow already created one via `ensureCrmRecord`. Idempotent via event delivery dedup. |

### 4.3 Read-model grants

- `search` and `analytics` may read `company_customers` and
  `customer_groups` for projection/aggregation purposes (declared
  read-model grant per ADR-0015).

## 5. State machines and concurrency

### 5.1 No status machine

`company_customers` has no status field. Records exist or they don't. The
`user_id` field transitions from NULL to a value when an unlinked record is
matched to a user account (via `ensureCrmRecord`). Once set, `user_id` is
never changed back to NULL (a deliberate constraint — the link is permanent;
to unlink, delete the CRM record).

### 5.2 Concurrent CRM creation (checkout race)

Two concurrent checkouts for the same user+company:

1. Both hit `ensureCrmRecord`.
2. First INSERT succeeds; second hits the unique `(company_id, user_id)`
   constraint.
3. On conflict, the handler does `ON CONFLICT DO NOTHING` then re-reads the
   existing row.
4. Both return the same `customerId`. The `customers.created` event is
   emitted only by the transaction that inserted.

### 5.3 Phone/email matching race

Two concurrent requests try to match the same unlinked record by phone:

1. The first `UPDATE ... SET user_id = $1 WHERE company_id = $2 AND phone = $3
   AND user_id IS NULL` acquires the row lock and sets `user_id`.
2. The second finds no matching row (the `WHERE user_id IS NULL` condition no
   longer holds).
3. The second falls through to the INSERT path, which succeeds (different
   `user_id`, or the unique constraint catches a true duplicate and falls
   back to read).

### 5.4 Group deletion

`ON DELETE SET NULL` on `company_customers.group_id` ensures that deleting a
group doesn't cascade-delete customers. Pricing resolution for those
customers skips the group level (group_id is NULL → no group price list).

### 5.5 Transaction boundaries

- `customers.ensureCrmRecord` runs inside the caller's transaction (orders
  checkout). The CRM row, event, audit, and idempotency key all commit
  atomically with the order.
- Staff CRUD: each action is its own transaction (standard core pattern).

## 6. Edge cases

1. **Cross-tenant probing.** Staff of company A reading/writing company B's
   customers → `NotFoundError` (tenant scope from verified membership;
   `crossTenantSuite`). Customer reading another user's CRM record →
   target resolver returns `NotFoundError`.

2. **Duplicate phone/email across companies.** Allowed — CRM records are
   company-scoped. The same phone number may appear in multiple companies'
   CRM.

3. **Duplicate phone/email within a company (unlinked records).** Allowed —
   the unique constraint is on `(company_id, user_id)`, not on phone/email.
   Staff may create multiple unlinked records with the same phone. The
   `ensureCrmRecord` matching picks the first match (by `created_at ASC`).

4. **User deletes their account.** `user_id` FK is `ON DELETE SET NULL` →
   the CRM record survives as unlinked. Order history references the CRM
   record by ID, so it remains intact.

5. **Staff creates customer with userId that already has a CRM record.**
   Returns the existing record (domain idempotency) without modification.
   Staff wanting to update it must use `customers.updateCustomer`.

6. **Discovery/chat/browse → no CRM.** ADR-0018: searching, viewing company
   profiles, browsing catalogs, opening chat conversations do NOT create CRM
   records. Only `customers.createCustomer` (staff) and
   `customers.ensureCrmRecord` (system, at checkout) create records.

7. **Customer with no linked account messages a company (chat).** Chat works
   without a CRM record; `company_customer_id` on the conversation is NULL.
   The CRM record is created only at checkout.

8. **EDRPOU collision on counterparty.** The unique
   `(company_id, edrpou) WHERE edrpou IS NOT NULL` constraint surfaces a
   `ConflictError`. Staff must update the existing record instead.

9. **Deleting a counterparty referenced by documents.** The documents module
   references counterparty via immutable snapshots; the FK from documents to
   counterparties is expected to be `ON DELETE RESTRICT` or documents store
   snapshot copies. If `RESTRICT`, the delete action returns
   `ConflictError("counterparty is referenced by documents")`.

10. **Concurrent group slug collision.** The unique `(company_id, slug)`
    constraint surfaces `ConflictError` on `createGroup`/`updateGroup`.

11. **ensureCrmRecord with NULL phone and email.** When `userId` is
    provided, matching by user_id is attempted first and is sufficient. If
    the user has no phone/email, the CRM record is still created (with NULL
    contact fields). This matches v1 behavior post-`create_company_customer_link_user`.

12. **Legal profile entity_type change.** Allowed — a sole proprietor may
    become an LLC. The `upsertMyLegalProfile` action overwrites entity_type.

13. **Multiple counterparties for the same customer.** Allowed — a customer
    may have multiple legal entities. `counterparties.customer_id` is not
    unique.

## 7. v1 migration notes

### 7.1 Tables

#### `company_customers` → `company_customers` (TRANSFORM)

Source migration: `20260301000008_customers_and_pricing.sql`, Part 3.

| v1 column | v2 column | Transform |
| --- | --- | --- |
| `id uuid` | `id uuid` | Direct copy |
| `company_id uuid` | `company_id uuid` | Direct copy |
| `user_id uuid` (nullable) | `user_id uuid` (nullable) | Auth-mapped (Supabase UID → better-auth ID) |
| `group_id uuid` | `group_id uuid` | Direct copy |
| `price_list_id uuid` | `price_list_id uuid` | Direct copy |
| `name text` | `name text` | Direct copy |
| `phone text` | `phone text` | Direct copy |
| `email text` | `email text` | Direct copy |
| `notes text` | `notes text` | Direct copy |
| `invite_id uuid` | — | DROP. Invite reference is not carried to v2 CRM (invites module tracks redemption state internally) |
| `embedding vector(1536)` | — | DROP. pgvector/embeddings are dropped (scope §5). Discovery uses FTS/trigram |
| `created_at` / `updated_at` | same | Direct copy |

**Cleanup:**
- Remove rows where `company_id` references a deleted company (should be
  caught by FK cascade, but verify).
- Auth-map all `user_id` values through the identity migration mapping.
- Report orphaned rows (user_id pointing to non-existent auth users).

**Reconciliation query:**
```sql
SELECT count(*) AS v1_count FROM company_customers;
SELECT count(*) AS v2_count FROM company_customers;
-- v2_count = v1_count (minus cleaned-up orphans, reported).

-- Verify unique constraint (company_id, user_id) WHERE user_id IS NOT NULL:
SELECT company_id, user_id, count(*)
FROM company_customers
WHERE user_id IS NOT NULL
GROUP BY company_id, user_id
HAVING count(*) > 1;
-- Must return 0 rows. Duplicates must be merged pre-migration.
```

#### `customer_groups` → `customer_groups` (TRANSFORM)

Source migration: `20260301000008_customers_and_pricing.sql`, Part 2.

| v1 column | v2 column | Transform |
| --- | --- | --- |
| `id uuid` | `id uuid` | Direct copy |
| `company_id uuid` | `company_id uuid` | Direct copy |
| `price_list_id uuid` | `price_list_id uuid` | Direct copy |
| `name text` | `name text` | Direct copy |
| `slug text` | `slug text` | Direct copy |
| `description text` | `description text` | Direct copy |
| `sort_order integer` | `sort_order integer` | Direct copy |
| `created_at` / `updated_at` | same | Direct copy |

No column additions or removals. Schema is structurally identical.

**Reconciliation query:**
```sql
SELECT count(*) AS v1_count FROM customer_groups;
SELECT count(*) AS v2_count FROM customer_groups;
-- Must match.

-- Verify unique (company_id, slug):
SELECT company_id, slug, count(*)
FROM customer_groups
GROUP BY company_id, slug
HAVING count(*) > 1;
-- Must return 0 rows.
```

#### `customer_legal_info` → `customer_legal_profiles` (TRANSFORM)

Source migration: `20260320000011_customer_legal_info.sql`.

| v1 column | v2 column | Transform |
| --- | --- | --- |
| `id uuid` | `id uuid` | Direct copy |
| `user_id uuid` | `user_id` (user id type) | Auth-mapped |
| `entity_type text` | `entity_type text` | Direct copy ('fop', 'tov') |
| `legal_name text` | `legal_name text` | Direct copy |
| `edrpou text` | `edrpou text` | Direct copy |
| `legal_address text` | `legal_address text` | Direct copy |
| `iban text` | `iban text` | Direct copy |
| `bank_name text` | `bank_name text` | Direct copy |
| `bank_mfo text` | `bank_mfo text` | Direct copy |
| `phone text` | `phone text` | Direct copy |
| `email text` | `email text` | Direct copy |
| `created_at` / `updated_at` | same | Direct copy |

**Cleanup:** Auth-map `user_id` values. Report rows with unmapped user IDs.

**Reconciliation query:**
```sql
SELECT count(*) AS v1_count FROM customer_legal_info;
SELECT count(*) AS v2_count FROM customer_legal_profiles;
-- Must match (minus rows with unmapped users, reported).
```

#### `counterparties` → `counterparties` (TRANSFORM)

Source migration: `20260320000005_documents_system.sql`, Part 1.

| v1 column | v2 column | Transform |
| --- | --- | --- |
| `id uuid` | `id uuid` | Direct copy |
| `company_id uuid` | `company_id uuid` | Direct copy |
| `user_id uuid` | `user_id` | Auth-mapped |
| `customer_id uuid` | `customer_id uuid` | Direct copy (FK to company_customers) |
| `name text` | `name text` | Direct copy |
| `edrpou text` | `edrpou text` | Direct copy |
| `legal_address text` | `legal_address text` | Direct copy |
| `iban text` | `iban text` | Direct copy |
| `bank_name text` | `bank_name text` | Direct copy |
| `bank_mfo text` | `bank_mfo text` | Direct copy |
| `phone text` | `phone text` | Direct copy |
| `email text` | `email text` | Direct copy |
| `notes text` | `notes text` | Direct copy |
| `created_at` / `updated_at` | same | Direct copy |

**Cleanup:**
- Auth-map `user_id`.
- Verify `customer_id` FKs still resolve after the `company_customers`
  migration (orphan customer_id → SET NULL, reported).

**Reconciliation query:**
```sql
SELECT count(*) AS v1_count FROM counterparties;
SELECT count(*) AS v2_count FROM counterparties;
-- Must match.

-- Verify unique (company_id, edrpou) WHERE edrpou IS NOT NULL:
SELECT company_id, edrpou, count(*)
FROM counterparties
WHERE edrpou IS NOT NULL
GROUP BY company_id, edrpou
HAVING count(*) > 1;
-- Duplicates must be merged pre-migration (report and resolve).
```

### 7.2 Functions and RPCs

| v1 object | Decision | v2 location |
| --- | --- | --- |
| `create_company_customer_link_user(...)` | TRANSFORM | `customers.ensureCrmRecord` system action (same phone/email matching, but invoked at checkout rather than from the chat panel; the v1 conversation-gate check is dropped — v2 CRM creation does not require a conversation) |
| `assistant_search_customers(...)` | TRANSFORM | `customers.listCustomers` (staff search with `search` param) serves the same purpose |
| `assistant_search_counterparties(...)` | TRANSFORM | `customers.listCounterparties` (staff search with `search` param) |

### 7.3 Triggers

| v1 trigger | Decision | v2 location |
| --- | --- | --- |
| `customers_update_timestamp` | KEEP | Shared `updated_at` trigger (db.md §5) |
| `set_customer_groups_updated_at` | KEEP | Shared `updated_at` trigger |
| `customer_legal_info_update_timestamp` | KEEP | Shared `updated_at` trigger |

### 7.4 RLS policies

All v1 RLS policies are DROP. The operation each authorized:

| v1 policy | v2 replacement |
| --- | --- |
| `company_customers: select` (user_id = auth.uid OR permission) | Customer: `customers.getMyCustomerRecord` target resolver. Staff: `customers:view` permission. |
| `company_customers: authenticated insert` (user_id = self OR permission) | Staff: `customers:create` on `createCustomer`. System: `ensureCrmRecord` (no permission — system principal). |
| `company_customers: update` (user_id = self OR permission) | Staff: `customers:edit` on `updateCustomer`. Customer self-edit is not carried (customers don't edit their own CRM record — they update their user profile elsewhere). |
| `company_customers: member delete` (permission) | Staff: `customers:delete` on `deleteCustomer`. |
| `customer_groups: select` (permission) | Staff: `customers:view` on `listGroups`/`getGroup`. |
| `customer_groups: insert/update/delete` (permission) | Staff: `customers:edit` on group CRUD. |
| `customer_groups: customer self read` (20260331000004) | Embedded in `customers.getCustomerPricingFacts` — pricing resolver loads group data inside the transaction, no direct customer access to the groups table. |
| `customer_legal_info: select/insert/update/delete own` | Customer: `getMyLegalProfile`/`upsertMyLegalProfile` via target resolver proving ownership. |
| `customer_legal_info: company member reads customer` | Staff: `customers.getCustomerLegalProfileForDocument` (internal read). |
| `counterparties` (member CRUD policies from documents_system migration) | Staff: `customers:view`/`customers:edit` on counterparty CRUD. |

### 7.5 Cutover order

1. Auth users mapped (prerequisite).
2. `customer_groups` (no FK dependencies beyond companies and price_lists).
3. `company_customers` (depends on customer_groups for `group_id` FK).
4. `customer_legal_profiles` (depends only on auth users).
5. `counterparties` (depends on company_customers for `customer_id` FK).
6. Run all reconciliation queries.

### 7.6 Rollback

Restore from pre-migration backup (db.md §6: forward-only migrations,
restore + roll forward). v1 tables are not modified.

## 8. Non-functional requirements

- **PII fields**: `company_customers.phone`, `email`, `name`;
  `customer_legal_profiles.*` (all fields are PII/business-sensitive);
  `counterparties.edrpou`, `iban`, `phone`, `email`. These are never logged
  in structured logs or domain-event payloads (payloads carry IDs only).
  Audit rows use hash-only policy (no `auditSnapshot` opt-in on any
  customers action).
- **Expected volumes**: typical company: 10–500 CRM customers, 1–10 groups,
  0–50 counterparties. `listCustomers` is the hot path on the panel
  customer screen. Pagination and trigram search must perform acceptably at
  1000+ customers (the upper bound for a micro-business at scale).
- **Rate limits**: default per principal (core.md §10).
  `customers.ensureCrmRecord` is system-internal and not client-rate-limited
  but is bounded by checkout rate.

## 9. Acceptance criteria

Mandatory minimum (inherited from template):

- [ ] Cross-tenant isolation: staff of company A cannot read/write customers
      of company B; customer target resolver returns `NotFoundError` for
      foreign CRM records with no existence leak.
- [ ] Authorization denial: staff without `customers:view` cannot list/get;
      staff without `customers:create` cannot create; staff without
      `customers:edit` cannot update/manage groups/counterparties; staff
      without `customers:delete` cannot delete.
- [ ] Validation failure surfaces typed `ValidationError` (missing
      name, invalid email, slug format, etc.).
- [ ] Runtime output validation: every action output passes its Zod schema;
      no JSON-unsafe values.
- [ ] Idempotency: `createCustomer` with same userId+company returns the
      existing record; `ensureCrmRecord` concurrent calls converge to one
      record; replay of write actions with same key returns stored result.
- [ ] Declared events emit transactionally (`eventSuite`); a failed create
      leaves no CRM record, event, or audit row.
- [ ] Audit records written for all `audit: true` actions with declared
      targets.

Module-specific:

- [ ] **ADR-0018 compliance**: discovery, chat opening, profile browsing,
      and cart interaction do NOT create CRM records. Only
      `customers.createCustomer` (staff) and `customers.ensureCrmRecord`
      (system/checkout) create records.
- [ ] **Checkout atomic CRM creation**: `ensureCrmRecord` called within the
      order transaction creates the CRM record atomically; the order
      references a valid `customerId` on commit; a rollback of the order
      also rolls back the CRM record.
- [ ] **Phone/email matching**: `ensureCrmRecord` matches unlinked records
      by phone then email before creating a new row; matched records get
      `user_id` set.
- [ ] **Concurrent ensureCrmRecord**: two simultaneous calls for the same
      user+company result in exactly one CRM record; both callers receive
      the same `customerId`; exactly one `customers.created` event is
      emitted.
- [ ] **Multi-company support**: one user can be a CRM customer of many
      companies; customer-principal actions resolve one company per
      invocation.
- [ ] **Group pricing chain**: deleting a group sets `group_id = NULL` on
      affected customers; pricing resolution for those customers correctly
      skips the group level.
- [ ] **Legal profile ownership**: only the owning user can read/write their
      legal profile via customer-principal actions; staff reads are via
      internal `getCustomerLegalProfileForDocument`.
- [ ] **Counterparty EDRPOU uniqueness**: creating a counterparty with a
      duplicate company+edrpou returns `ConflictError`.
- [ ] **Counterparty delete protection**: deleting a counterparty referenced
      by documents fails with `ConflictError`.
- [ ] **`ctx.call` targets are `risk: read`**: all cross-module read actions
      (`getCustomerPricingFacts`, `getCustomerOrderFacts`,
      `getCounterpartyForDocument`, etc.) are implemented as `risk: read`
      and verified by CI contract check.
- [ ] **Cascade behavior**: deleting a company cascades to all its CRM
      records, groups, and counterparties; deleting a user sets
      `company_customers.user_id` to NULL.

## 10. Composition contract (required callee capabilities)

Per ADR-0015, the following `ctx.call` targets must be provided by their
owning modules. Gaps block implementation and must be reported.

| Callee | Action (expected) | Principal modes | What customers needs |
| --- | --- | --- | --- |
| `orders` | `orders.getCustomerOrderCount` | `staff` | Customer ID → count of orders (for delete confirmation summary) |
| `companies` | Company existence/visibility read | `customer` | Used in `getMyLegalProfile`/`upsertMyLegalProfile` target resolver to prove company exists |

## 11. Composition contract (provided callee capabilities)

Actions this module exposes for `ctx.call` by other modules:

| Caller | Action | What it provides |
| --- | --- | --- |
| `pricing` | `customers.getCustomerPricingFacts` | Customer pricing chain facts |
| `pricing` | `customers.getCustomerPricingFactsForUser` | Same, from customer-principal context |
| `chat` | `customers.getCustomerOrderFacts` | Batch customer display facts for conversation hydration |
| `orders` | `customers.ensureCrmRecord` | Atomic CRM link/create at checkout |
| `orders` | `customers.getCustomerForCheckout` | Pre-check CRM existence |
| `documents` | `customers.getCounterpartyForDocument` | Counterparty requisites for snapshot |
| `documents` | `customers.getCustomerLegalProfileForDocument` | Legal profile for B2B document requisites |

## Changelog

| Date | Change | Why | Reported by |
| --- | --- | --- | --- |
| 2026-08-17 | Initial draft | Step 4 of spec-rework queue: customers module specification | spec agent |
