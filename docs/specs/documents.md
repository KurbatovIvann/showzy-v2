# Spec: documents (owner-first slice)

> Status: Living.
> Active surface: none.
> Density beyond the declared slice is intent, not contract; do not treat unimplemented sections as frozen.
> Written against blueprint §2.1, §4, §5, §7.1; scope §1.1, §2.1, §3, §6, §7
> phase 8; ADR-0008, ADR-0011, ADR-0012, ADR-0013, ADR-0014, ADR-0015,
> ADR-0016, ADR-0020, ADR-0021, **ADR-0022** (`share` principal);
> `docs/specs/core.md`, `docs/specs/db.md`, `docs/specs/money.md`,
> `docs/specs/contract.md`, `docs/specs/security-operations.md`,
> `docs/specs/payments.md`, `docs/specs/orders.md`,
> `docs/specs/companies.md`, `docs/specs/customers.md`,
> `docs/module-ownership.md`.
>
> **Owner-first launch (2026-08-19):** the company panel (staff/AI) creates
> documents from a staff order, numbers them, snapshots parties/totals.
> The owner QES-signs on-device, then hands over a share link / QR / print.
> The counterparty **does not need a Showzy account**: the share page can
> download the supplier-signed artifact and apply a second QES. Dual-sign
> without login is required product, not cabinet expansion. Recording that
> second signature uses **ADR-0022** (unauthenticated write principal
> `share`) after fnd-T11B, fnd-T23B, and the security-operations rework
> land. Customer-cabinet
> `getMine` / in-app review remain Deferred.
> QES keys never leave the device (`doc-signing`). PDF rendering is
> `doc-generation`.
>
> See `docs/specs/README.md`. `/rework-spec` applies only after a surface
> is Active.

## Living intent (always)

### Purpose

The `documents` module is the source of truth for commercial document
identity, numbering, lifecycle, and immutable party/line/total snapshots
(agreements, delivery notes, payment invoices, completion acts). It emits
lifecycle events; `payments`, `doc-generation`, `doc-signing`, chat, and
notifications subscribe and store `documentId`, never a second copy of
totals or signature bytes (ADR-0011).

It explicitly does NOT own: PDF/DOCX bytes or generation jobs
(`doc-generation` + `files`), QES keys/signatures/ASiC-E/verification
(`doc-signing`, ADR-0012), CRM counterparties or customer legal profiles
(`customers`), company legal requisites (`companies`), order/payment
authority (`orders` / `payments`), or the chat projection (`chat`).

### Invariants and principal modes

- **Tenant isolation.** Staff scope is verified membership. Public share
  scope is a typed `resolveTarget` over a hashed capability token, never a
  `companyId` in input (ADR-0013, ADR-0020). System consumers use explicit
  tenant scope from the delivered event.
- **Money snapshots.** Document lines copy the order's persisted rounded
  snapshots at create time. Totals are sums of those lines. Issued documents
  never recompute from current catalog, pricing, or requisites (money.md).
- **Numbering is consumed.** Cancelling a document does not rewind the
  per-company/type/year counter (v1 `next_document_number` behavior, moved
  to application code — db.md §5).
- **Projections.** Chat/notifications store `documentId`. This module does
  not store PDF URLs, signature files, or derived generation job state.
- **No `documents.sign`.** Blueprint/core.md use that name as an example.
  Recording a QES result is `doc-signing`'s write; this module only consumes
  the resulting event to advance `status`.
- **Signed payload is immutable.** After the first QES, the document bytes
  never change. A second signature is **appended** to the ASiC-E/CAdES
  container. The share page must not replace the PDF with a restamped file.
- **"Both parties signed"** is asserted only when a verified counterparty
  certificate tax id (ЄДРПОУ/ІПН) matches the frozen `buyer_details.edrpou`.
  A valid KEP from someone else is `ValidationError`; status stays
  `supplier_signed`.

Principal modes this module uses: **`staff`** (panel create/list/get/share),
**`public`** (share-link **read**, `publicScope: target`), **`share`**
(ADR-0022 — token-bound **co-sign write**, owned by `doc-signing`),
**`system`** (`markSigned`, `getForSystem`). **`customer`** cabinet reads
remain Deferred. No `consumer` or `account` actions.

### Named capabilities

**Owner-first (this slice):**

| Name | Intent |
| --- | --- |
| `documents.createFromOrder` | Create a numbered document from an order + counterparty, freeze snapshots |
| `documents.get` | Staff read of one document including items and party snapshots |
| `documents.list` | Staff list/filter for the panel |
| `documents.listTemplates` | Staff list of seeded default templates (metadata, no Plate body) |
| `documents.cancel` | Cancel an unsigned issued document; number stays consumed |
| `documents.createShare` | Mint/rotate a capability token for link/QR handover |
| `documents.revokeShare` | Revoke the active share token |
| `documents.getShared` | Public-target read of the current authorized document by token |
| `documents.getForSystem` | Tenant-scoped system read for generation/signing workers |
| `documents.markSigned` | System: apply `doc-signing.recorded` to lifecycle (`supplier_signed` / `fully_signed`) |
| `documents.created` | Document identity exists (aggregate `document`) |
| `documents.invoiceGenerated` | `payment_invoice` created — `payments.attachInvoice` |
| `documents.cancelled` | Document cancelled |
| `documents.signed` | Supplier QES recorded (`issued` → `supplier_signed`) |
| `documents.fullySigned` | Counterparty QES recorded and party-matched (`supplier_signed` → `fully_signed`) |

**`doc-signing` composition (not owned here; required for the share page):**
`doc-signing.prepareShareSign` (`share` read — digest + legal summary),
`doc-signing.submitShareSignature` (`share` write — verify container, store,
emit `doc-signing.recorded`). Staff supplier signing stays a panel action
with `risk: high` + confirmation.

**Deferred: customer expansion** (names only): `documents.getMine`,
`documents.listMine`, in-cabinet review. Dual-sign **via share link** is
owner-first, not deferred.

**Deferred: post-launch / web / spike §9:** `documents.createDraft`,
`documents.updateDraft`, company `document_templates` CRUD
(`documents:manage`), Plate/mobile template editing, DOCX export, standalone
create without an order, parent `agreementId` workflow.

### Principal selection guidance

- **staff** — panel/AI acting as a company member. Create, list, get, cancel,
  share, revoke, supplier QES. Company from verified membership.
- **public** — unauthenticated holder of a share token. **Read-only**
  structured facts + download URLs. Not an ADR-0020 discovery projection.
- **share** (ADR-0022) — same token, **unauthenticated write** to
  record a counterparty QES. Lives on `doc-signing`, not on `public`.
- **system** — outbox consumers (`markSigned`) and workers (`getForSystem`).
- **customer** — cabinet ownership. Not this slice.

### Slice boundary

This file's first implementing PRs cover:

- tables `documents`, `document_items`, `document_number_counters`,
  `default_document_templates`, `document_share_tokens`;
- the owner-first actions/events listed above;
- numbering in the handler (no `assign_document_number` trigger);
- share via token (Universal Link / QR / print are client concerns);
- dual-sign on that page (record path is `doc-signing`, lifecycle updates
  stay here). Blocked on fnd-T11B + fnd-T23B + `/rework-spec
  security-operations.md`, not on ADR or contract.md acceptance.

Explicitly **not** this module's schema: `document_signatures`, generation
jobs, file objects, `counterparties`, `company_legal_info`. Company custom
`document_templates` are not created in this slice (scope §3: seed defaults
only; admin template UI is web phase).

### Proposed product defaults (confirm before `/plan`)

These are the contested calls this draft uses. Change them here; do not
leave them as `REVIEW` in the migration slice.

| # | Question | Proposed default used below |
| --- | --- | --- |
| P1 | Which types in the API? | All four v1 types. Panel may feature invoice + delivery note first. |
| P2 | Required order status? | Any order except `canceled`. |
| P3 | One active doc per `(order, type)`? | Yes, among non-cancelled rows. |
| P4 | Share vs signature | Share is allowed from `issued` (download/print). **Co-sign UI** only after `supplier_signed`. Panel success path: owner QES then `createShare` in the same screen (raw token is shown once; the server stores only the hash, so a background job cannot invent a link the owner can display). |
| P5 | Share TTL / rotation? | 90 days; `createShare` rotates the active token. No view-count on `getShared` (public reads cannot write). |
| P6 | Numbering year? | Calendar year in `Europe/Kyiv`. |
| P7 | Counterparty input? | Required `counterpartyId`. No auto-create. If the counterparty is linked to a CRM row, it must match `order.customerId`. |
| P8 | Long-lived drafts / money edits? | No. Create issues immediately (`issued`). Cancel + recreate to change parties or lines. Cancel is **forbidden** after `supplier_signed`. |
| P9 | When is it "both parties"? | Only if counterparty KEP tax id matches frozen `buyer_details.edrpou`. Otherwise `ValidationError`, status unchanged. |
| P10 | Safe sharing extras | Token + TTL + rotate/revoke in this slice. Optional PIN / knowledge factor and pre-minted one-time PDF URLs are later hardening, not required to ship the page. |

### Unauthenticated share + co-sign (product contract)

Canonical path (owner-first):

1. Staff creates the document (`createFromOrder`) → `issued`, snapshots frozen.
2. Owner QES-signs in the panel (`doc-signing`, client-side key) → this module
   consumes `doc-signing.recorded` `{ signerRole: "supplier" }` →
   `supplier_signed`, event `documents.signed`.
3. Panel calls `documents.createShare` and shows link/QR (raw token once).
4. Counterparty opens the link **without a Showzy session**:
   `documents.getShared` (`public` read) shows parties, totals, number,
   signature status, and a download of the **current container** (payload +
   supplier signature). The page states the legal effect of a second
   signature (e.g. confirming receipt on a delivery note).
5. Counterparty confirms on-device, signs **the same payload hash** with
   their KEP, submits via `doc-signing.submitShareSignature` (`share`
   principal, ADR-0022). Server verifies the container, matches tax id to
   buyer snapshot, stores the appended signature, emits
   `doc-signing.recorded` `{ signerRole: "counterparty" }`.
6. `documents.markSigned` → `fully_signed`, event `documents.fullySigned`.
   The same share URL now downloads the dual-signed container. Bytes of the
   original PDF/payload do not change.

Showzy is not a party and not a КНЕДП. Users are responsible for whether
to sign and for authority to sign. Showzy is responsible for integrity of
the stored payload, for not restamping signed bytes, and for not labelling
the document fully signed unless P9 holds.

Co-sign **implementation is blocked** until fnd-T11B (core `share` factory),
fnd-T23B (HTTP/oRPC share dispatch), and `/rework-spec
security-operations.md` land. `getShared` can ship earlier (download-only).

---

## Slice / Active contract (about to be built)

### Owned tables

All tables live in `packages/db/src/schema/documents.ts` (ADR-0014). This
module imports only that schema file.

#### `default_document_templates`

Global seeded defaults (scope §3, db.md §9). No `company_id`.

| Column | Type | Constraints / default | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | PK | |
| `type` | `text NOT NULL` | CHECK `IN ('agreement','delivery_note','payment_invoice','completion_act')` | |
| `name` | `text NOT NULL` | | Display name |
| `description` | `text` | Nullable | |
| `content` | `jsonb NOT NULL` | | Opaque Plate JSON for `doc-generation`. This slice does not interpret it. |
| `is_default` | `boolean NOT NULL` | Default `true` | |
| `created_at` / `updated_at` | `timestamptz` | `now()`; `updated_at` trigger | |

**Indexes:** unique `(type) WHERE is_default = true`.

Seed: one default row per type. Placeholder `content` is allowed until the
`doc-generation` task replaces it with the real templates in a follow-up
migration. No staff/admin write actions in this slice.

#### `document_number_counters`

| Column | Type | Constraints / default | Notes |
| --- | --- | --- | --- |
| `company_id` | `uuid NOT NULL` | FK → `companies.id` `ON DELETE CASCADE` | |
| `type` | `text NOT NULL` | Same CHECK as document type | |
| `year` | `integer NOT NULL` | | `Europe/Kyiv` calendar year at assign time |
| `last_number` | `bigint NOT NULL` | Default `0`, CHECK `>= 0` | |

**PK:** `(company_id, type, year)`.

No client access. Handlers lock the row (`SELECT … FOR UPDATE` / upsert)
inside the pipeline transaction.

#### `documents`

| Column | Type | Constraints / default | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | PK | |
| `company_id` | `uuid NOT NULL` | FK → `companies.id` `ON DELETE CASCADE` | Tenant root |
| `type` | `text NOT NULL` | CHECK four types | |
| `document_number` | `text NOT NULL` | | `{prefix}-{TYPE}-{year}/{seq:06}` |
| `status` | `text NOT NULL` | Default `'issued'`, CHECK `IN ('issued','supplier_signed','fully_signed','cancelled')` | § State machines |
| `order_id` | `uuid NOT NULL` | FK → `orders.id` `ON DELETE RESTRICT` | Owner-first always from an order |
| `counterparty_id` | `uuid NOT NULL` | FK → `counterparties.id` `ON DELETE RESTRICT` | Live link for delete-protection; display uses snapshots |
| `template_id` | `uuid` | Nullable; FK → `default_document_templates.id` `ON DELETE RESTRICT` | Default used at create |
| `template_name` | `text NOT NULL` | | Name snapshot |
| `template_source` | `text NOT NULL` | Default `'system'`, CHECK `IN ('system')` | `'custom'` added with company templates |
| `supplier_details` | `jsonb NOT NULL` | Zod-validated `PartySnapshot` | Company legal snapshot |
| `buyer_details` | `jsonb NOT NULL` | Zod-validated `PartySnapshot` | Counterparty snapshot |
| `total_net_minor` | `bigint NOT NULL` | CHECK `>= 0` | Sum of lines |
| `total_tax_minor` | `bigint NOT NULL` | CHECK `>= 0` | |
| `total_gross_minor` | `bigint NOT NULL` | CHECK `>= 0` | |
| `currency` | `char(3) NOT NULL` | Default `'UAH'` | |
| `notes` | `text` | Nullable | Free-text on the document |
| `additional_terms` | `text` | Nullable | Agreements |
| `valid_from` / `valid_until` | `date` | Nullable | Agreements |
| `payment_due_date` | `date` | Nullable | Invoices |
| `created_by` | user id | Nullable; FK users `ON DELETE SET NULL` | Actor at create |
| `created_at` / `updated_at` | `timestamptz` | `now()`; `updated_at` trigger | |

**Constraints / indexes:**

- Unique `(company_id, type, document_number)`.
- Unique `(company_id, order_id, type) WHERE status <> 'cancelled'` (P3).
- `(company_id, created_at DESC)`, `(company_id, status)`, `(company_id, type)`,
  `(order_id)`, `(counterparty_id)`.

No `deleted_at`, `pdf_url`, `docx_url`, `content`, `signature_*`, `signed_by`,
`signed_at`, `agreement_id`. Those v1 columns move or drop per § v1 migration.

#### `document_items`

Immutable line snapshots (money.md). No `updated_at`.

| Column | Type | Constraints / default | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | PK | |
| `company_id` | `uuid NOT NULL` | FK → `companies.id` `ON DELETE CASCADE` | Denormalized tenant |
| `document_id` | `uuid NOT NULL` | FK → `documents.id` `ON DELETE CASCADE` | |
| `product_id` | `uuid NOT NULL` | FK → `products.id` `ON DELETE RESTRICT` | History must not vanish |
| `variant_id` | `uuid` | Nullable; FK → `product_variants.id` `ON DELETE RESTRICT` | |
| `title_snapshot` | `text NOT NULL` | | From the order line |
| `quantity_milli` | `bigint NOT NULL` | CHECK `> 0` | Scale 3 |
| `unit_price_minor` | `bigint NOT NULL` | CHECK `>= 0` | Copied, not re-resolved |
| `discount_kind` | `text NOT NULL` | CHECK `IN ('none')` this slice | Additive later |
| `discount_value` / `discount_amount_minor` | `bigint NOT NULL` | Default `0`; amount CHECK `>= 0` | |
| `tax_treatment` | `text NOT NULL` | CHECK `IN ('exempt','inclusive','exclusive')` | Copied |
| `tax_rate_bp` | `integer NOT NULL` | CHECK `>= 0` | |
| `tax_amount_minor` / `net_amount_minor` / `gross_amount_minor` | `bigint NOT NULL` | CHECK `>= 0` | |
| `currency` | `char(3) NOT NULL` | Default `'UAH'` | |
| `sort_order` | `integer NOT NULL` | | Stable print order |
| `created_at` | `timestamptz` | Default `now()` | |

**Indexes:** `(document_id)`, `(company_id)`, `(product_id)`.

#### `document_share_tokens`

| Column | Type | Constraints / default | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | PK | |
| `company_id` | `uuid NOT NULL` | FK → `companies.id` `ON DELETE CASCADE` | |
| `document_id` | `uuid NOT NULL` | FK → `documents.id` `ON DELETE CASCADE` | |
| `token_hash` | `text NOT NULL` | Unique | SHA-256 hex of the raw token |
| `expires_at` | `timestamptz NOT NULL` | | Create + 90 days |
| `revoked_at` | `timestamptz` | Nullable | |
| `created_by` | user id | Nullable; `ON DELETE SET NULL` | |
| `created_at` | `timestamptz` | Default `now()` | |

**Indexes:** unique `token_hash`; unique `(document_id) WHERE revoked_at IS NULL`
(one active token); `(company_id, document_id)`.

Raw tokens are never stored, logged, or audited. Idempotent replay of
`createShare` may return the token from the **idempotency response snapshot**
to the same caller only (core.md §5).

### Permissions (seed)

Insert into `role_permission_defaults` in this module's schema/seed
migration (same pattern as catalog):

| Role | Permissions |
| --- | --- |
| admin | `documents:view`, `documents:create`, `documents:edit`, `documents:delete` |
| manager | `documents:view`, `documents:create`, `documents:edit` |
| employee | `documents:view` |

`documents:manage` waits on company templates. Owner has all known keys
implicitly. Nested `ctx.call` still enforces callee permissions: creating
staff must also hold `orders:view` and `customers:view` (seed those in the
orders/customers tasks if missing). `companies.getForStaffRead` is
`permissions: []`.

### Shared output shapes

Wire money/quantity are canonical decimal strings (contract.md, money.md).

```ts
const DocumentType = z.enum([
  "agreement",
  "delivery_note",
  "payment_invoice",
  "completion_act",
]);

const DocumentStatus = z.enum([
  "issued",
  "supplier_signed",
  "fully_signed",
  "cancelled",
]);

const PartySnapshot = z.object({
  legalName: z.string(),
  entityType: z.enum(["fop", "tov"]).nullable(),
  edrpou: z.string(),
  legalAddress: z.string().nullable(),
  iban: z.string().nullable(),
  bankName: z.string().nullable(),
  bankMfo: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
});

const DocumentItem = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
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
  sortOrder: z.number().int(),
  createdAt: z.string().datetime(),
});

const Document = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  type: DocumentType,
  documentNumber: z.string(),
  status: DocumentStatus,
  orderId: z.string().uuid(),
  counterpartyId: z.string().uuid(),
  templateId: z.string().uuid().nullable(),
  templateName: z.string(),
  templateSource: z.enum(["system"]),
  supplier: PartySnapshot,
  buyer: PartySnapshot,
  totalNetMinor: z.string(),
  totalTaxMinor: z.string(),
  totalGrossMinor: z.string(),
  currency: z.string().length(3),
  notes: z.string().nullable(),
  additionalTerms: z.string().nullable(),
  validFrom: z.string().nullable(), // ISO date
  validUntil: z.string().nullable(),
  paymentDueDate: z.string().nullable(),
  createdBy: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  items: z.array(DocumentItem),
  activeShare: z
    .object({
      expiresAt: z.string().datetime(),
    })
    .nullable(),
});

const SharedDocument = Document.omit({
  createdBy: true,
  activeShare: true,
}).extend({
  payloadHash: z.string().nullable(),
  canCounterpartySign: z.boolean(),
  pdfDownloadUrl: z.string().url().nullable(),
  pdfDownloadExpiresAt: z.string().datetime().nullable(),
  signatures: z.array(
    z.object({
      role: z.enum(["supplier", "counterparty"]),
      signerCn: z.string().nullable(),
      signerOrg: z.string().nullable(),
      signedAt: z.string().datetime(),
    }),
  ),
});
```

`pdfDownloadUrl` / `payloadHash` / `signatures` are null or empty until
`files` / `doc-signing` expose the callees in § Composition. `canCounterpartySign`
is `true` only when `status = supplier_signed`. Public output never includes
staff identity or other companies' documents.

### Actions

#### `documents.createFromOrder`

| Field | Value |
| --- | --- |
| Name | `documents.createFromOrder` |
| Description | Create a numbered business document from an existing order of this company. Copy the order's immutable line snapshots and freeze supplier and buyer legal requisites at this moment. Later price or requisite changes must not affect this document. Require a counterparty and complete legal names plus tax IDs for both parties. Human-invoked high-risk signing is a separate module. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ orderId: z.string().uuid(), counterpartyId: z.string().uuid(), type: DocumentType, notes: z.string().max(2000).optional(), additionalTerms: z.string().max(8000).optional(), validFrom: z.string().date().optional(), validUntil: z.string().date().optional(), paymentDueDate: z.string().date().optional() }` |
| Output | `Document` |
| Permissions | `["documents:create"]` |
| aiExposure | `exposed` |
| risk | `write` |
| requiresConfirmation | `false` |
| Idempotent | `true` — client-supplied key; scope `company:<companyId>`; same key + different input → `IdempotencyConflictError`; replay returns the stored document |
| Emits | `["documents.created"]`; also `["documents.invoiceGenerated"]` when `type = payment_invoice` |
| Audit | `true` |
| auditTarget | `{ type: "document", id: <created id> }` (hash-only; no party snapshots, IBAN, or items in `inputSnapshot`) |
| Timeout | `10_000` |
| Calls | `orders.get`, `customers.getCounterpartyForDocument`, `companies.getForStaffRead` |
| Atomic calls | `[]` |

**Handler outline:** load order (same company; `status <> canceled`; ≥1 item)
→ load counterparty (same company; if `customerId` set, equals
`order.customerId`) → load company `prefix` + `legalInfo` → reject when
supplier or buyer lacks `legalName` or `edrpou` (`ValidationError`, field
list in `clientMessage`) → resolve default template for `type` → reject
when an active row already exists for `(order, type)` (`ConflictError`) →
assign number (lock counter, format below) → insert `documents` +
`document_items` copied from order lines (shared money service is **not**
re-run; copy persisted minor units) → emit `documents.created` (and
`documents.invoiceGenerated` for invoices).

**Number format** (v1 `next_document_number`, in code):
`{company.prefix}-{typePrefix}-{year}/{seq}` with `seq` zero-padded to 6.
Type prefixes: `agreement` → `ДГ`, `delivery_note` → `ВН`,
`payment_invoice` → `РХ`, `completion_act` → `АВ`. Year from `Europe/Kyiv`.

#### `documents.get`

| Field | Value |
| --- | --- |
| Name | `documents.get` |
| Description | Get one document of this company by ID, including line snapshots and frozen party requisites. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ documentId: z.string().uuid() }` |
| Output | `Document` |
| Permissions | `["documents:view"]` |
| aiExposure | `exposed` |
| risk | `read` |
| requiresConfirmation | `false` |
| Idempotent | `false` |
| Emits | `[]` |
| Audit | `false` |
| Timeout | `2_000` |
| Calls | `[]` |

Missing or foreign id → `NotFoundError` (no existence leak).

#### `documents.list`

| Field | Value |
| --- | --- |
| Name | `documents.list` |
| Description | List this company's documents, newest first, optionally filtered by type, status, or order. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ type: DocumentType.optional(), status: DocumentStatus.optional(), orderId: z.string().uuid().optional(), cursor: z.string().optional(), limit: z.number().int().min(1).max(50).default(20) }` |
| Output | `{ items: z.array(Document.omit({ items: true })), nextCursor: z.string().nullable() }` |
| Permissions | `["documents:view"]` |
| aiExposure | `exposed` |
| risk | `read` |
| requiresConfirmation | `false` |
| Idempotent | `false` |
| Emits | `[]` |
| Audit | `false` |
| Timeout | `3_000` |
| Calls | `[]` |

List rows omit line arrays (panel list). `get` loads items. Cursor is an
opaque `(createdAt, id)` key.

#### `documents.listTemplates`

| Field | Value |
| --- | --- |
| Name | `documents.listTemplates` |
| Description | List the system default document templates this company can use. Do not return Plate JSON bodies. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ type: DocumentType.optional() }` |
| Output | `{ items: z.array(z.object({ id: z.string().uuid(), type: DocumentType, name: z.string(), description: z.string().nullable(), isDefault: z.boolean() })) }` |
| Permissions | `["documents:view"]` |
| aiExposure | `exposed` |
| risk | `read` |
| requiresConfirmation | `false` |
| Idempotent | `false` |
| Emits | `[]` |
| Audit | `false` |
| Timeout | `2_000` |
| Calls | `[]` |

#### `documents.cancel`

| Field | Value |
| --- | --- |
| Name | `documents.cancel` |
| Description | Cancel an unsigned issued document of this company. The document number is not reused. Documents that already have a supplier QES cannot be cancelled. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ documentId: z.string().uuid() }` |
| Output | `Document` |
| Permissions | `["documents:delete"]` |
| aiExposure | `exposed` |
| risk | `high` |
| requiresConfirmation | `true` |
| Confirmation summary | Type, document number, buyer `legalName`, gross total + currency. No IBAN. |
| Idempotent | `true` — client key; scope `company:<companyId>`; replay returns the cancelled document |
| Emits | `["documents.cancelled"]` |
| Audit | `true` |
| auditTarget | `{ type: "document", id: input.documentId }` |
| Timeout | `5_000` |
| Calls | `[]` |
| Atomic calls | `[]` |

`SELECT … FOR UPDATE`. `issued` → `cancelled`. Already `cancelled` + same
key → replay. Already `cancelled` + new key, or `supplier_signed` /
`fully_signed` → `ConflictError`.
Revoke any active share token in the same transaction.

#### `documents.createShare`

| Field | Value |
| --- | --- |
| Name | `documents.createShare` |
| Description | Create or rotate a secret share token so the owner can hand this document over by link or QR without requiring a Showzy account. Do not log the raw token. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ documentId: z.string().uuid() }` |
| Output | `{ documentId: z.string().uuid(), token: z.string(), expiresAt: z.string().datetime() }` |
| Permissions | `["documents:edit"]` |
| aiExposure | `exposed` |
| risk | `write` |
| requiresConfirmation | `false` |
| Idempotent | `true` — client key; scope `company:<companyId>` |
| Emits | `[]` |
| Audit | `true` |
| auditTarget | `{ type: "document", id: input.documentId }` (hash-only; never snapshot `token`) |
| Timeout | `5_000` |
| Calls | `[]` |

Cancelled documents → `ConflictError`. Allowed in `issued`,
`supplier_signed`, and `fully_signed`. Mint 32 random bytes, URL-safe
encode, store SHA-256. Revoke the previous active row. TTL 90 days.
The panel **must** call this after a successful supplier QES if the owner
needs a link; the raw token cannot be recovered later.

#### `documents.revokeShare`

| Field | Value |
| --- | --- |
| Name | `documents.revokeShare` |
| Description | Revoke the active share token for this document so existing links stop working. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ documentId: z.string().uuid() }` |
| Output | `{ documentId: z.string().uuid(), revoked: z.literal(true) }` |
| Permissions | `["documents:edit"]` |
| aiExposure | `exposed` |
| risk | `write` |
| requiresConfirmation | `false` |
| Idempotent | `true` — client key; scope `company:<companyId>`; already-revoked is success |
| Emits | `[]` |
| Audit | `true` |
| auditTarget | `{ type: "document", id: input.documentId }` |
| Timeout | `5_000` |
| Calls | `[]` |

#### `documents.getShared`

| Field | Value |
| --- | --- |
| Name | `documents.getShared` |
| Description | Return the document authorized by this share token so a counterparty without a Showzy account can view, download the current signed container, and (when `supplier_signed`) co-sign. Invalid, expired, revoked, or cancelled tokens must look like not found. |
| Principal | `public` |
| Transport | `client` |
| Target/public scope | `publicScope: "target"`; `resolveTarget` hashes `token`, loads the active unexpired share + document, returns `{ companyId, resource }`. Unknown/expired/revoked/cancelled → `NotFoundError`. |
| Input | `{ token: z.string().min(16).max(256) }` |
| Output | `SharedDocument` |
| Permissions | `[]` |
| aiExposure | `internal` |
| risk | `read` |
| requiresConfirmation | `false` |
| Idempotent | `false` |
| Emits | `[]` |
| Audit | `false` |
| Timeout | `3_000` |
| Rate limit | Public default (30/min, `ipHmac`) |
| Calls | `files.getShareDownload` and `doc-signing.getShareFacts` **when those actions exist** (public-target / principal-compatible reads). Until then download URL, payload hash, and `signatures` are empty and `canCounterpartySign` is derived from `status` only. |

Not an ADR-0020 global discovery projection. Instantiate
`publicProjectionSuite` only if a global grant is added later — this action
uses the public-target resolver path instead.

#### `documents.getForSystem`

| Field | Value |
| --- | --- |
| Name | `documents.getForSystem` |
| Description | Return a document in this tenant for generation or signing workers. |
| Principal | `system` |
| Transport | `internal` |
| System scope | `tenant` |
| Input | `{ documentId: z.string().uuid() }` |
| Output | `Document` |
| Permissions | `[]` |
| aiExposure | `internal` |
| risk | `read` |
| requiresConfirmation | `false` |
| Idempotent | `false` |
| Emits | `[]` |
| Audit | `false` |
| Timeout | `2_000` |
| Calls | `[]` |

Wrong tenant or missing id → `NotFoundError`.

#### `documents.markSigned`

| Field | Value |
| --- | --- |
| Name | `documents.markSigned` |
| Description | Apply a recorded QES to this tenant's document lifecycle. Do not accept signature bytes. Supplier → `supplier_signed`; party-matched counterparty → `fully_signed`. |
| Principal | `system` |
| Transport | `internal` |
| System scope | `tenant` |
| Input | `eventEnvelopeSchema` (core.md §6) whose payload includes `{ documentId: z.string().uuid(), signerRole: z.enum(["supplier","counterparty"]) }` |
| Output | `{ documentId: z.string().uuid(), status: DocumentStatus }` |
| Permissions | `[]` |
| aiExposure | `internal` |
| risk | `write` |
| requiresConfirmation | `false` |
| Idempotent | `true` — key = delivered event id; scope tenant |
| Emits | `["documents.signed", "documents.fullySigned"]` |
| Audit | `true` |
| auditTarget | `{ type: "document", id: payload.documentId }` |
| Timeout | `5_000` |
| Calls | `[]` |

`issued` + supplier → `supplier_signed` (emit `documents.signed`).
`supplier_signed` + counterparty → `fully_signed` (emit `documents.fullySigned`).
Supplier on an already `supplier_signed`/`fully_signed` row, or counterparty
on an already `fully_signed` row → success no-op (idempotent event).
Counterparty while still `issued` → `ConflictError` (owner must sign first).
`cancelled` → `ConflictError`.

### Events

Envelope version `1`, `scope: "tenant"`, aggregate `{ type: "document", id }`.

#### Emitted

| Event | Payload | Subscribers |
| --- | --- | --- |
| `documents.created` | `{ documentId, orderId, type, documentNumber }` | `doc-generation` (queue PDF), `notifications` (owner), chat (expansion) |
| `documents.invoiceGenerated` | `{ documentId, orderId }` | `payments.attachInvoice` (payments spec §5) |
| `documents.cancelled` | `{ documentId, orderId, type }` | `doc-generation` (cancel job), `notifications` |
| `documents.signed` | `{ documentId, orderId }` | `notifications`; chat expansion |
| `documents.fullySigned` | `{ documentId, orderId }` | `notifications`; chat expansion |

Payloads carry IDs and type/number only — not party snapshots, IBAN, or
items (security-operations §6).

#### Consumed

| Source | Consumer id | Action | Materializes |
| --- | --- | --- | --- |
| `doc-signing.recorded` (defined in `doc-signing` spec) | `documents/mark-signed` | `documents.markSigned` | Lifecycle only. Not signature bytes. Party match is enforced in `doc-signing` before this event. |

This slice does **not** subscribe to `companies.legalInfoUpdated`. Issued
snapshots stay frozen (money.md). The companies spec subscriber line is
corrected to match.

`orders.*` is not consumed: staff create documents explicitly (no
auto-invoice on confirm).

#### Read-model grants

None. `search` / `analytics` do not read document tables in this slice.

### State machines and concurrency

```
createFromOrder          → issued
issued + supplier QES    → supplier_signed
supplier_signed + matched counterparty QES → fully_signed
issued → cancelled
supplier_signed / fully_signed → (no cancel)
fully_signed → (terminal)
cancelled → (terminal)
```

- Two `createFromOrder` races on the same `(order, type)`: unique partial
  index; loser gets `ConflictError`. Idempotent retry of the winner's key
  replays.
- Numbering races: row lock on `(company_id, type, year)` in the handler
  transaction; unique `(company_id, type, document_number)` is the backstop.
- `createShare` concurrent: one active-token unique index; one winner,
  the other retries or conflicts.
- Cancel vs sign: row lock; any QES recorded → cancel conflicts; cancelled
  cannot sign.
- Two counterparty submits: `doc-signing` unique `(document_id, signer_role)`
  (v1); loser `ConflictError`; documents consumer is idempotent on event id.
- Generation failure does not undo the document (journey invariant). Retry
  generation against the same `documentId`. Payload for QES is the generated
  artifact; co-sign is blocked until that artifact exists (`payloadHash`
  non-null).
- No atomic cross-module writes (ADR-0021 `[]`). Client orchestrates
  supplier QES then `createShare`.

### Edge cases

1. **Missing company or counterparty requisites.** No row, no number
   consumed. `ValidationError` names missing fields (`legalName`, `edrpou`).
   v1 allowed sparse jsonb snapshots; v2 refuses to issue.
2. **Counterparty CRM mismatch.** Linked `customer_id` ≠ order customer →
   `ValidationError`. Standalone counterparties (`customer_id` null) are
   allowed (v1 standalone FOPs).
3. **Second invoice for the same order.** Active unique index →
   `ConflictError`. Cancel first, then create.
4. **Create against a canceled order.** `ConflictError`.
5. **Order in another company.** `orders.get` / tenant filter →
   `NotFoundError`.
6. **Delete counterparty referenced by documents.** FK `RESTRICT`;
   customers spec already maps this to `ConflictError`.
7. **Product deleted after order.** `document_items.product_id` RESTRICT
   (same as orders). Display uses `title_snapshot`.
8. **Year boundary.** 31 Dec 22:00 UTC may still be the next Kyiv year;
   counters are per Kyiv calendar year.
9. **Share token leak.** Rotate (`createShare`) or `revokeShare`. Expired
    and revoked tokens are `NotFoundError`, same as unknown. Forwarded
    messenger links are expected; do not use a one-open counter on GET.
10. **Public enumeration.** Guessing tokens is infeasible (256-bit); rate
    limit still applies. Document ids are not accepted as public input.
11. **Unauthenticated co-sign with a KEP that is not the buyer.**
    `doc-signing.submitShareSignature` rejects (`ValidationError`). Status
    stays `supplier_signed`. UI must not say both parties signed.
12. **Co-sign before supplier QES.** Submit rejected; `getShared`
    `canCounterpartySign = false`.
13. **Co-sign before PDF exists.** `payloadHash` null → prepare/submit
    conflict. Retry after generation.
14. **AI create.** Same action as UI; no confirmation on create (matches
    `orders.create`). Staff supplier QES is `high` + confirmation. Share
    ingest is `write` (ADR-0022): the KEP on device is the intent.
15. **Idempotency vs unique (order, type).** First success inserts; retry
    same key returns it; a new key hitting the unique index is a caller
    creating a duplicate logical invoice → `ConflictError`.
16. **v1 soft-delete trigger.** Dropped. Cancel is explicit. No `DELETE`
    from staff actions.
17. **Invoice cancel vs payment.** This module emits `documents.cancelled`.
    Detaching/cancelling the payment record is `payments`' decision; do not
    write payment rows here.
18. **Prefix change after issue.** Number already stored; companies may
    freeze prefix on publish. Historical numbers keep the assigned string.

### v1 migration notes

Source: `20260320000005_documents_system.sql`,
`20260320000007_documents_storage_and_events.sql`,
`20260331000005_add_document_content_type.sql`,
`20260404000001_document_signing_columns.sql`,
`20260406000002_fix_fully_signed_status.sql`,
`20260416000001_secure_get_company_templates.sql`,
`20260416000002_documents_policy_and_index_fixes.sql`.
Matrix: documents tables TRANSFORM; signing TRANSFORM under `doc-signing`.
No `REVIEW` rows.

#### `documents` (TRANSFORM)

| v1 column | v2 | Transform |
| --- | --- | --- |
| `id`, `company_id`, `type`, `document_number` | same | Direct copy |
| `status` `draft\|sent\|signed\|cancelled` | `issued\|supplier_signed\|fully_signed\|cancelled` | `draft`/`sent` → `issued`; v1 `signed` + not fully signed → `supplier_signed`; v1 `fully_signed` → `fully_signed`; `cancelled` keep |
| `order_id` | `order_id NOT NULL` | Rows with null `order_id` are **orphan report** (standalone v1 docs); launch cutover requires a manual order or skip-with-ticket — do not invent orders |
| `counterparty_id` | `NOT NULL`, `ON DELETE RESTRICT` (was SET NULL) | Null v1 rows → orphan report |
| `agreement_id` | — | DEFER column; preserve in a one-off mapping table if any non-null rows exist at rehearsal |
| `supplier_details`, `buyer_details` | same jsonb | Validate into `PartySnapshot`; invalid/missing name or EDRPOU → orphan report |
| `items` jsonb | `document_items` rows | See items table |
| `total_amount numeric` | `total_gross_minor` | `ROUND(total_amount * 100)::bigint`; assert no sub-kopiykas |
| — | `total_net_minor`, `total_tax_minor` | Sum of migrated lines; v1 had no tax → net = gross, tax = 0 unless lines disagree (report) |
| `currency` | `char(3)` | Default `UAH`; non-UAH → report |
| `notes`, `additional_terms`, dates | same | Direct copy |
| `template_id`, `template_name` | same | Remap `template_source = custom` to the system default of that type; keep `template_name` snapshot |
| `template_source` | `'system'` only this slice | Custom → system default id |
| `content` | — | DROP from documents (generation-owned artifact) |
| `pdf_url`, `docx_url` | — | TRANSFORM to `files` / `doc-generation` artifact links |
| `signature_status`, `signature_url`, `signature_algorithm`, `signed_at`, `signed_by`, `signer_cn`, `signer_org` | — | TRANSFORM to `doc-signing`; v2 `status=fully_signed` when v1 `signature_status = fully_signed`; v2 `supplier_signed` when a supplier `document_signatures` row exists; else `issued` |
| `deleted_at` | — | DROP; `deleted_at IS NOT NULL` → `cancelled` if not already |
| `created_by`, timestamps | same | Direct copy |

**Cleanup:** skip `deleted_at` rows that were already `cancelled`; report
null order/counterparty; report money that is not an integer kopiyka.

**Reconciliation:** count of non-deleted v1 documents vs v2 rows; per-company
sum of `ROUND(total_amount*100)` vs `sum(total_gross_minor)`; unique
`(company_id, type, document_number)` set equality.

**Cutover:** after orders, customers (`counterparties`), companies (prefix +
legal info), catalog (product FKs). Before relying on share tokens (new;
v1 had no public document token — no rows to migrate).

**Rollback:** restore v1 snapshot; v2 share tokens are new data (acceptable
loss in a failed cutover).

#### `document_items` (new; from `documents.items`)

| Source | Target | Transform |
| --- | --- | --- |
| jsonb `{name, unit, qty, price, total}` | money.md columns | `quantity_milli = qty * 1000` when qty is whole; fractional qty → milli with scale-3 assert; `unit_price_minor = ROUND(price*100)`; `gross = ROUND(total*100)`; tax/discount none/exempt; `title_snapshot = name`; `product_id` from matching `order_items` by position/name; unmatched → report |

#### `document_number_counters` (TRANSFORM)

Direct copy `(company_id, type, year, last_number)`. After copy, assert
`last_number >= max(seq parsed from document_number)` per key.

#### `default_document_templates` (TRANSFORM)

Copy v1 rows. Company `document_templates` → DEFER table; rehearsal counts
custom rows; launch uses system default per type.

#### Functions / triggers / RLS

| Object | Decision |
| --- | --- |
| `next_document_number`, `set_document_number`, `assign_document_number` | MOVE to `createFromOrder` numbering service |
| `get_company_templates` | MOVE to `documents.listTemplates` (defaults only) |
| `documents_soft_delete`, `trg_documents_soft_delete` | DROP; explicit `cancel` |
| `fn_documents_outbox`, `trg_documents_outbox` | DROP; `ctx.emit` |
| `can_read_document_object` + storage policies | TRANSFORM to `files` + `getShared` / staff `get` |
| `recompute_document_signature_status`, `trg_document_signatures_recompute_status` | MOVE to `doc-signing` + `documents.markSigned` |
| RLS on all document tables | DROP; action permissions + public-target / `share` resolvers + system scope |
| `messages` content_type `'document'` | `chat` expansion; not this schema |

#### Storage bucket

`documents-bucket` → `files` private prefix. Path convention v1
`{company_id}/{document_id}/{document_number}.pdf` may be preserved as a
files key, not a documents column.

### Non-functional requirements

- PII: EDRPOU, IBAN, addresses, phones, emails in snapshots. Logs/audit
  hash-only. Events carry IDs. Public `getShared` is the intended disclosure
  to a token holder.
- PDF size: security-operations 25 MiB cap applies in `files`, not here.
- Volume: owner-first is tens of documents/day per company, not a search
  projection.
- Share token: 32-byte CSPRNG; SHA-256 at rest.
- Share page: public GET is not an audit event; co-sign write is audited
  (ADR-0022, actor `system:share` + certificate snapshot).

### Composition contract

**This module calls**

| Callee | Why |
| --- | --- |
| `orders.get` | Order identity, status, line snapshots (`orders:view`) |
| `customers.getCounterpartyForDocument` | Buyer requisites (`customers:view`) |
| `companies.getForStaffRead` | Prefix + `legalInfo` (`permissions: []`) |
| `files.getShareDownload` (files spec must add, public-target) | Optional PDF/ASiC-E URL on `getShared` |
| `doc-signing.getShareFacts` (doc-signing spec must add, public-target) | Payload hash + signature list on `getShared` |

**This module provides**

| Caller | Action |
| --- | --- |
| `doc-generation` | `documents.getForSystem` |
| `doc-signing` | `documents.getForSystem` |
| Panel/AI | staff get/list/create/share |
| Anonymous handover (read) | `documents.getShared` |
| Anonymous co-sign (write) | not this module — `doc-signing.submitShareSignature` (`share`) |
| `payments` | event `documents.invoiceGenerated` (not a `ctx.call`) |

**Gaps (do not workaround in this module):**

1. `files.getShareDownload` is unspecified until `/spec files`. Share still
   ships structured facts + print.
2. `doc-signing` spec must declare `getShareFacts`, `prepareShareSign`,
   `submitShareSignature`, and `doc-signing.recorded`. `markSigned` is idle
   until that subscription exists.
3. **Co-sign waits on fnd-T11B** (core `share` factory) plus **fnd-T23B**
   (HTTP dispatch) and `/rework-spec security-operations.md`. `contract.md`
   is amended. ADR-0022 is accepted. `getShared` (download-only) can ship
   without the factory. Do not fold the write into `public`.

**Companies spec consistency:** `companies.legalInfoUpdated` does not
refresh issued documents.

### Acceptance criteria

- [ ] Staff of company A cannot get/list/cancel/share company B's documents
      (`crossTenantSuite`).
- [ ] Missing `documents:create` / `view` / `edit` / `delete` denies the
      matching write/read (`PermissionDeniedError`).
- [ ] Public `getShared` with a foreign or random token is `NotFoundError`;
      no company id in input; cancelled/expired/revoked match unknown.
- [ ] `getShared` does not emit events or write audit rows; public metadata
      is `audit: false`, `emits: []`, `idempotent: false`.
- [ ] System `getForSystem` / `markSigned` with the wrong tenant scope is
      `NotFoundError` / denied without leaking the row.
- [ ] Validation: missing requisites, bad type, extra keys — typed
      `ValidationError`.
- [ ] Output money/quantity are decimal strings; runtime output validation
      holds.
- [ ] `createFromOrder` same key/same payload replays; same key/different
      payload conflicts; two logical creates for one `(order, type)`
      conflict (`idempotencySuite` + unique index).
- [ ] Totals equal the sum of copied order lines (money.md); changing
      company legal info or catalog prices afterwards does not change the
      document.
- [ ] Number format and monotonic `last_number` under concurrency (two
      parallel creates, different orders, same type/year).
- [ ] Cancel of `issued` emits `documents.cancelled` in the same
      transaction; cancel of `supplier_signed` / `fully_signed` conflicts;
      confirmation required.
- [ ] `payment_invoice` create emits `documents.invoiceGenerated` and
      `documents.created`; other types emit only `created`.
- [ ] `markSigned` is idempotent on event id; supplier role transitions
      `issued` → `supplier_signed` and emits `documents.signed` once;
      matched counterparty transitions `supplier_signed` → `fully_signed`
      and emits `documents.fullySigned` once; counterparty while `issued`
      conflicts.
- [ ] `getShared` sets `canCounterpartySign` true only for `supplier_signed`.
- [ ] `createShare` never logs or audits the raw token; rotate invalidates
      the previous hash.
- [ ] Co-sign tests (after fnd-T11B and fnd-T23B): token A cannot submit for
      document B; EDRPOU mismatch does not change status; payload bytes after
      second signature equal payload bytes after first; no CRM row is created.
- [ ] No raw SQL in module handlers; no `packages/core` edits except
      fnd-T11B (the ADR-0022 core slice). HTTP dispatch is fnd-T23B.
- [ ] Inherited protocol suites registered in `suiteCoverage` for every
      action (core.md §12).

### Core change request

**ADR-0022 (`share` principal)** — accepted 2026-08-19. `core.md` and
`contract.md` Active surfaces are amended (`/rework-spec`). Remaining:
`/rework-spec security-operations.md`, then scaffold **fnd-T11B** and
**fnd-T23B**. Numbering in this module still uses ordinary
`SELECT … FOR UPDATE` via Drizzle; that is not a core change.

---

## Changelog

| Date | Change | Why | Reported by |
| --- | --- | --- | --- |
| 2026-08-19 | contract.md share dispatch amended; co-sign blocked on fnd-T11B + fnd-T23B + security-ops rework | HTTP rules for unauthenticated capability-token writes | owner via `/rework-spec contract.md` |
| 2026-08-19 | ADR-0022 accepted; co-sign blocked on fnd-T11B + contract/security-ops rework, not on ADR | core.md Active surface amended | owner via `/rework-spec core.md` |
| 2026-08-19 | Unauthenticated share + co-sign is owner-first: immutable payload, append second QES, EDRPOU match for `fully_signed`, statuses `supplier_signed`/`fully_signed`, ADR-0022 | Required product: handover without Showzy login | owner via spec discussion |
| 2026-08-19 | Initial Living draft: owner-first from-order documents, numbering, snapshots, public share token; generation/signing as sibling modules | `/spec documents` | spec agent |
