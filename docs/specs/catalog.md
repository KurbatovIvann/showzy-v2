# Spec: catalog

> Status: Draft.
> Written against blueprint §2.1, §4, §5; scope §2, §6, §7;
> ADR-0008, ADR-0013, ADR-0014, ADR-0015, ADR-0016, ADR-0018;
> `docs/specs/core.md`, `docs/specs/db.md`, `docs/specs/money.md`,
> `docs/specs/contract.md`, `docs/specs/pricing.md`,
> `docs/specs/companies.md`, `docs/module-ownership.md`;
> spec-rework-queue Step 3b.

## 1. Purpose

The `catalog` module owns company products, product categories, product
options/variants, product media (image links), unit types, SKU generation,
and the product publication/active lifecycle. It exposes staff CRUD for all
catalog entities, `consumer`-principal published-product discovery reads
(ADR-0018), `customer`-principal company-scoped product reads, `public`-
principal single-product reads for direct-link previews, and read actions
consumed by other modules (`pricing`, `orders`) via `ctx.call`.

It explicitly does **not** own: price lists or resolved prices (`pricing`),
CRM customer records or groups (`customers`), order/cart snapshots
(`orders`), file/attachment bytes or metadata (`files`), search projections
(`search`), or the company profile/publication lifecycle (`companies`).

## 2. Owned tables

All tables live in `packages/db/src/schema/catalog.ts` (ADR-0014).

### 2.1 `product_categories`

| Column | Type | Constraints / default | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `company_id` | `uuid NOT NULL` | FK → `companies.id` ON DELETE CASCADE | Tenant root |
| `name` | `text NOT NULL` | | Category display name |
| `sort_order` | `integer` | default `0` | UI ordering |
| `created_at` | `timestamptz` | default `now()` | |
| `updated_at` | `timestamptz` | trigger-maintained | |

**Indexes:**
- Unique `(company_id, name)` — one category name per company
- `(company_id)` — tenant-scoped queries

### 2.2 `unit_types`

| Column | Type | Constraints / default | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `company_id` | `uuid NOT NULL` | FK → `companies.id` ON DELETE CASCADE | Tenant root |
| `code` | `text NOT NULL` | | Short code (e.g. `kg`, `pc`, `l`) |
| `name` | `text NOT NULL` | | Human-readable name |
| `symbol` | `text` | nullable | Display symbol |
| `is_default` | `boolean` | default `false` | Company default unit |
| `sort_order` | `integer` | default `0` | UI ordering |
| `created_at` | `timestamptz` | default `now()` | |
| `updated_at` | `timestamptz` | trigger-maintained | |

**Indexes:**
- Unique `(company_id, code)` — one code per company
- `(company_id)` — tenant-scoped queries

### 2.3 `products`

| Column | Type | Constraints / default | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `company_id` | `uuid NOT NULL` | FK → `companies.id` ON DELETE CASCADE | Tenant root |
| `name` | `text NOT NULL` | | Product display name |
| `description` | `text` | nullable | Rich description |
| `base_price_minor` | `bigint NOT NULL` | CHECK `base_price_minor >= 0` | Base price in minor units (kopiykas); the lowest fallback for pricing resolution |
| `currency` | `char(3) NOT NULL` | default `'UAH'` | Per db.md §3 |
| `unit_type_id` | `uuid` | nullable, FK → `unit_types.id` ON DELETE SET NULL | |
| `category_id` | `uuid` | nullable, FK → `product_categories.id` ON DELETE SET NULL | |
| `sku` | `text` | NOT NULL | Auto-generated if omitted on create; company-unique |
| `barcode` | `text` | nullable | EAN-13/UPC for fiscal receipts and scanning |
| `hide_price` | `boolean` | default `false` | If true, price is hidden in storefront |
| `is_active` | `boolean` | default `true` | Active = available for orders; inactive = hidden from storefront/consumer |
| `is_published` | `boolean` | default `false` | Published = visible in consumer discovery (when also active and company is published) |
| `stock_quantity` | `integer` | default `0` | Current stock; enforced only when `track_inventory = true` |
| `track_inventory` | `boolean` | default `true` | Whether to track and enforce inventory limits |
| `low_stock_threshold` | `integer` | default `5` | Threshold for low-stock warnings |
| `allow_backorders` | `boolean` | default `false` | Allow orders when stock = 0 |
| `weight_value` | `numeric(10,4)` | nullable | Product weight |
| `weight_unit` | `text` | nullable, CHECK `(g\|kg\|oz\|lb)` | Weight unit |
| `length_value` | `numeric(10,4)` | nullable | Length dimension |
| `width_value` | `numeric(10,4)` | nullable | Width dimension |
| `height_value` | `numeric(10,4)` | nullable | Height dimension |
| `dimension_unit` | `text` | nullable, CHECK `(mm\|cm\|m\|in)` | Dimension unit |
| `volume_value` | `numeric(10,4)` | nullable | Volume/capacity |
| `volume_unit` | `text` | nullable, CHECK `(ml\|l)` | Volume unit |
| `sort_order` | `integer` | default `0` | UI ordering |
| `created_at` | `timestamptz` | default `now()` | |
| `updated_at` | `timestamptz` | trigger-maintained | |

**Constraints (carried from v1):**
- `products_weight_consistency`: `(weight_value IS NULL) = (weight_unit IS NULL)`
- `products_volume_consistency`: `(volume_value IS NULL) = (volume_unit IS NULL)`
- `products_dimension_consistency`: at least one dimension present ↔ dimension_unit present
- `products_stock_quantity_check`: `stock_quantity >= 0 OR NOT track_inventory`

**Indexes:**
- Unique `(company_id, sku)` — SKU unique per company
- Unique `(company_id, barcode) WHERE barcode IS NOT NULL` — barcode unique per company when present
- `(company_id)` — tenant-scoped queries
- `(company_id, is_active, is_published) WHERE is_active = true AND is_published = true` — partial index for published product reads
- `(company_id, category_id)` — category filter queries
- `(company_id, sort_order, created_at)` — default list ordering

**Dropped from v1:**
- `status_id` (FK → `company_statuses`) — replaced by `is_active`/`is_published` booleans. V1 used a status system with `company_statuses.code = 'active'`; v2 replaces this with explicit product-level booleans.
- `image_url` — replaced by `product_media` links to `files`.
- `likes_count` — dropped with social mechanics (ADR-0018).
- `embedding` — dropped with vector search (ADR-0018).
- `fts` — dropped generated column; FTS authority moves to `search` projections.
- `uktzed` — deferred to `acquiring` module (fiscal/excise classification).

### 2.4 `company_sku_sequences`

| Column | Type | Constraints / default | Notes |
| --- | --- | --- | --- |
| `company_id` | `uuid` | PK, FK → `companies.id` ON DELETE CASCADE | One sequence per company |
| `next_val` | `integer NOT NULL` | default `1` | Next SKU sequence number |

Per-company counter for auto-generating sequential product SKU codes.
The v1 trigger `trg_auto_generate_sku` is moved into the
`catalog.createProduct` action handler.

### 2.5 `product_media`

Renamed from v1 `product_images` to reflect file-module integration.

| Column | Type | Constraints / default | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `product_id` | `uuid NOT NULL` | FK → `products.id` ON DELETE CASCADE | |
| `company_id` | `uuid NOT NULL` | FK → `companies.id` ON DELETE CASCADE | Denormalized for tenant-scoped queries |
| `file_id` | `uuid NOT NULL` | FK → `files.id` ON DELETE CASCADE | Cross-module FK to `files` module |
| `display_order` | `integer NOT NULL` | default `1` | Lower numbers displayed first |
| `is_primary` | `boolean NOT NULL` | default `false` | Primary/main image for the product |
| `created_at` | `timestamptz` | default `now()` | |
| `updated_at` | `timestamptz` | trigger-maintained | |

**Indexes:**
- `(product_id, display_order)` — ordered media per product
- Partial unique `(product_id) WHERE is_primary = true` — at most one primary image per product
- `(company_id)` — tenant-scoped queries

### 2.6 `product_options`

Option groups per product (e.g. "Color", "Size").

| Column | Type | Constraints / default | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `product_id` | `uuid NOT NULL` | FK → `products.id` ON DELETE CASCADE | |
| `company_id` | `uuid NOT NULL` | FK → `companies.id` ON DELETE CASCADE | Denormalized for tenant-scoped queries |
| `name` | `text NOT NULL` | | Option group name (e.g. "Color") |
| `sort_order` | `integer` | default `0` | Display ordering |
| `created_at` | `timestamptz` | default `now()` | |
| `updated_at` | `timestamptz` | trigger-maintained | |

**Indexes:**
- `(product_id)` — options per product
- `(company_id)` — tenant-scoped queries
- Unique `(product_id, name)` — one option group name per product

### 2.7 `product_option_values`

Values within option groups (e.g. "Red", "Blue" for Color).

| Column | Type | Constraints / default | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `option_id` | `uuid NOT NULL` | FK → `product_options.id` ON DELETE CASCADE | |
| `value` | `text NOT NULL` | | Display value |
| `sort_order` | `integer` | default `0` | Display ordering |
| `created_at` | `timestamptz` | default `now()` | |
| `updated_at` | `timestamptz` | trigger-maintained | |

**Indexes:**
- `(option_id)` — values per option
- Unique `(option_id, value)` — unique value per option group

### 2.8 `product_variants`

Unique combinations of option values per product.

| Column | Type | Constraints / default | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `product_id` | `uuid NOT NULL` | FK → `products.id` ON DELETE CASCADE | |
| `company_id` | `uuid NOT NULL` | FK → `companies.id` ON DELETE CASCADE | Denormalized for tenant-scoped queries |
| `sku` | `text` | nullable | Variant-level SKU override |
| `base_price_minor` | `bigint` | nullable, CHECK `base_price_minor >= 0` | Variant-level base price override; null = use product base price |
| `currency` | `char(3)` | nullable | Set alongside `base_price_minor`; null when price is null |
| `weight_value` | `numeric(10,4)` | nullable | Variant weight override |
| `weight_unit` | `text` | nullable, CHECK `(g\|kg\|oz\|lb)` | Weight unit |
| `stock_quantity` | `integer` | default `0` | Variant-level stock |
| `track_inventory` | `boolean` | default `true` | Track variant stock |
| `allow_backorders` | `boolean` | default `false` | Allow orders at 0 stock |
| `is_active` | `boolean` | default `true` | Inactive variants hidden from resolution |
| `sort_order` | `integer` | default `0` | Display ordering |
| `created_at` | `timestamptz` | default `now()` | |
| `updated_at` | `timestamptz` | trigger-maintained | |

**Constraints:**
- `product_variants_weight_consistency`: `(weight_value IS NULL) = (weight_unit IS NULL)`
- `product_variants_price_consistency`: `(base_price_minor IS NULL) = (currency IS NULL)`

**Indexes:**
- `(product_id)` — variants per product
- `(company_id)` — tenant-scoped queries
- Unique `(company_id, sku) WHERE sku IS NOT NULL` — variant SKU unique per company when present

### 2.9 `product_variant_options`

Junction table: variant ↔ option value.

| Column | Type | Constraints / default | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `variant_id` | `uuid NOT NULL` | FK → `product_variants.id` ON DELETE CASCADE | |
| `option_id` | `uuid NOT NULL` | FK → `product_options.id` ON DELETE CASCADE | |
| `option_value_id` | `uuid NOT NULL` | FK → `product_option_values.id` ON DELETE CASCADE | |

**Indexes:**
- Unique `(variant_id, option_id)` — one value per option per variant
- `(variant_id)` — options per variant
- `(option_value_id)` — reverse lookup

### 2.10 Not owned (explicit boundary)

| Data | Owner | How catalog interacts |
| --- | --- | --- |
| Price lists, price list entries, personal prices | `pricing` | Pricing calls `catalog.getProductPricingFacts` via `ctx.call` |
| CRM customer records, groups | `customers` | No direct interaction |
| Order/cart snapshots | `orders` | Orders calls `catalog.getProductFacts` via `ctx.call` |
| File bytes and metadata | `files` | Catalog references `file_id` FK; file upload/download via `files` actions |
| Company publication status | `companies` | Consumer reads check company publication via `ctx.call` to `companies.getPublishedCompany` |
| FTS/trigram search projections | `search` | Search reads catalog tables via read-model grant |

## 3. Actions

Shared output types referenced below:

```ts
const ProductCategory = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  name: z.string(),
  sortOrder: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const UnitType = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  symbol: z.string().nullable(),
  isDefault: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const ProductMedia = z.object({
  id: z.string().uuid(),
  fileId: z.string().uuid(),
  displayOrder: z.number().int(),
  isPrimary: z.boolean(),
});

const ProductOptionValue = z.object({
  id: z.string().uuid(),
  value: z.string(),
  sortOrder: z.number().int(),
});

const ProductOption = z.object({
  id: z.string().uuid(),
  name: z.string(),
  sortOrder: z.number().int(),
  values: z.array(ProductOptionValue),
});

const ProductVariant = z.object({
  id: z.string().uuid(),
  sku: z.string().nullable(),
  basePriceMinor: z.string().nullable(),
  currency: z.string().length(3).nullable(),
  weightValue: z.string().nullable(),
  weightUnit: z.string().nullable(),
  stockQuantity: z.number().int(),
  trackInventory: z.boolean(),
  allowBackorders: z.boolean(),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
  options: z.array(z.object({
    optionId: z.string().uuid(),
    optionName: z.string(),
    optionValueId: z.string().uuid(),
    value: z.string(),
  })),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const Product = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  basePriceMinor: z.string(),
  currency: z.string().length(3),
  unitTypeId: z.string().uuid().nullable(),
  categoryId: z.string().uuid().nullable(),
  sku: z.string(),
  barcode: z.string().nullable(),
  hidePrice: z.boolean(),
  isActive: z.boolean(),
  isPublished: z.boolean(),
  stockQuantity: z.number().int(),
  trackInventory: z.boolean(),
  lowStockThreshold: z.number().int(),
  allowBackorders: z.boolean(),
  weightValue: z.string().nullable(),
  weightUnit: z.string().nullable(),
  lengthValue: z.string().nullable(),
  widthValue: z.string().nullable(),
  heightValue: z.string().nullable(),
  dimensionUnit: z.string().nullable(),
  volumeValue: z.string().nullable(),
  volumeUnit: z.string().nullable(),
  sortOrder: z.number().int(),
  media: z.array(ProductMedia),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const ProductSummary = z.object({
  id: z.string().uuid(),
  name: z.string(),
  basePriceMinor: z.string(),
  currency: z.string().length(3),
  sku: z.string(),
  isActive: z.boolean(),
  isPublished: z.boolean(),
  categoryId: z.string().uuid().nullable(),
  categoryName: z.string().nullable(),
  unitTypeCode: z.string().nullable(),
  unitTypeSymbol: z.string().nullable(),
  primaryMediaFileId: z.string().uuid().nullable(),
  hasVariants: z.boolean(),
  stockQuantity: z.number().int(),
  trackInventory: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
```

---

### 3.1 Product categories

---

#### `catalog.createCategory`

| Field | Value |
| --- | --- |
| Name | `catalog.createCategory` |
| Description | Create a product category for this company. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ name: z.string().min(1).max(200), sortOrder: z.number().int().optional().default(0) }` |
| Output | `ProductCategory` |
| Permissions | `["categories:manage"]` |
| aiExposure | `exposed` |
| risk | `write` |
| requiresConfirmation | `false` |
| Idempotent | `true` — key: client-supplied; scope: `company:<companyId>`; conflict: `IdempotencyConflictError` |
| Emits | `[]` |
| Audit | `true` |
| auditTarget | `{ type: "product_category", id: output.id }` |
| Timeout | `5_000` |

**Handler:** Insert into `product_categories`. Unique `(company_id, name)` violation → `ConflictError("CATEGORY_NAME_TAKEN")`.

---

#### `catalog.updateCategory`

| Field | Value |
| --- | --- |
| Name | `catalog.updateCategory` |
| Description | Update a product category's name or sort order. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ categoryId: z.string().uuid(), name: z.string().min(1).max(200).optional(), sortOrder: z.number().int().optional() }` |
| Output | `ProductCategory` |
| Permissions | `["categories:manage"]` |
| aiExposure | `exposed` |
| risk | `write` |
| requiresConfirmation | `false` |
| Idempotent | `true` — key: client-supplied; scope: `company:<companyId>` |
| Emits | `[]` |
| Audit | `true` |
| auditTarget | `{ type: "product_category", id: input.categoryId }` |
| Timeout | `5_000` |

**Handler:** Load category by ID within `ctx.companyId`. Not found → `NotFoundError`. Name collision → `ConflictError("CATEGORY_NAME_TAKEN")`.

---

#### `catalog.deleteCategory`

| Field | Value |
| --- | --- |
| Name | `catalog.deleteCategory` |
| Description | Delete a product category. Products in this category will have their category set to null. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ categoryId: z.string().uuid() }` |
| Output | `{ deleted: z.literal(true) }` |
| Permissions | `["categories:manage"]` |
| aiExposure | `exposed` |
| risk | `write` |
| requiresConfirmation | `false` |
| Idempotent | `true` — key: client-supplied; scope: `company:<companyId>`; replay: `{ deleted: true }` |
| Emits | `[]` |
| Audit | `true` |
| auditTarget | `{ type: "product_category", id: input.categoryId }` |
| Timeout | `5_000` |

**Handler:** Load category. Not found → `NotFoundError`. Delete row; `ON DELETE SET NULL` on `products.category_id` handles product unlinking.

---

#### `catalog.listCategories`

| Field | Value |
| --- | --- |
| Name | `catalog.listCategories` |
| Description | List all product categories for this company. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ }` |
| Output | `{ categories: z.array(ProductCategory) }` |
| Permissions | `["products:view"]` |
| aiExposure | `exposed` |
| risk | `read` |
| requiresConfirmation | `false` |
| Idempotent | `false` |
| Emits | `[]` |
| Audit | `false` |
| Timeout | `3_000` |

---

### 3.2 Unit types

---

#### `catalog.createUnitType`

| Field | Value |
| --- | --- |
| Name | `catalog.createUnitType` |
| Description | Create a unit type for product measurement (e.g. kg, piece, liter). |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ code: z.string().min(1).max(20), name: z.string().min(1).max(100), symbol: z.string().max(10).optional(), isDefault: z.boolean().optional().default(false), sortOrder: z.number().int().optional().default(0) }` |
| Output | `UnitType` |
| Permissions | `["settings:units"]` |
| aiExposure | `exposed` |
| risk | `write` |
| requiresConfirmation | `false` |
| Idempotent | `true` — key: client-supplied; scope: `company:<companyId>`; conflict: `IdempotencyConflictError` |
| Emits | `[]` |
| Audit | `true` |
| auditTarget | `{ type: "unit_type", id: output.id }` |
| Timeout | `5_000` |

**Handler:** If `isDefault: true`, atomically unset any existing default within the same transaction. Unique `(company_id, code)` violation → `ConflictError("UNIT_CODE_TAKEN")`.

---

#### `catalog.updateUnitType`

| Field | Value |
| --- | --- |
| Name | `catalog.updateUnitType` |
| Description | Update a unit type's name, symbol, default status, or sort order. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ unitTypeId: z.string().uuid(), code: z.string().min(1).max(20).optional(), name: z.string().min(1).max(100).optional(), symbol: z.string().max(10).nullable().optional(), isDefault: z.boolean().optional(), sortOrder: z.number().int().optional() }` |
| Output | `UnitType` |
| Permissions | `["settings:units"]` |
| aiExposure | `exposed` |
| risk | `write` |
| requiresConfirmation | `false` |
| Idempotent | `true` — key: client-supplied; scope: `company:<companyId>` |
| Emits | `[]` |
| Audit | `true` |
| auditTarget | `{ type: "unit_type", id: input.unitTypeId }` |
| Timeout | `5_000` |

---

#### `catalog.deleteUnitType`

| Field | Value |
| --- | --- |
| Name | `catalog.deleteUnitType` |
| Description | Delete a unit type. Products using it will have their unit type set to null. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ unitTypeId: z.string().uuid() }` |
| Output | `{ deleted: z.literal(true) }` |
| Permissions | `["settings:units"]` |
| aiExposure | `exposed` |
| risk | `write` |
| requiresConfirmation | `false` |
| Idempotent | `true` — key: client-supplied; scope: `company:<companyId>` |
| Emits | `[]` |
| Audit | `true` |
| auditTarget | `{ type: "unit_type", id: input.unitTypeId }` |
| Timeout | `5_000` |

---

#### `catalog.listUnitTypes`

| Field | Value |
| --- | --- |
| Name | `catalog.listUnitTypes` |
| Description | List all unit types for this company. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ }` |
| Output | `{ unitTypes: z.array(UnitType) }` |
| Permissions | `["products:view"]` |
| aiExposure | `exposed` |
| risk | `read` |
| requiresConfirmation | `false` |
| Idempotent | `false` |
| Emits | `[]` |
| Audit | `false` |
| Timeout | `3_000` |

---

### 3.3 Products

---

#### `catalog.createProduct`

| Field | Value |
| --- | --- |
| Name | `catalog.createProduct` |
| Description | Create a new product. If SKU is omitted, an auto-generated sequential SKU is assigned. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ name: z.string().min(1).max(300), description: z.string().max(5000).optional(), basePriceMinor: z.string(), currency: z.string().length(3).optional().default("UAH"), unitTypeId: z.string().uuid().optional(), categoryId: z.string().uuid().optional(), sku: z.string().min(1).max(50).optional(), barcode: z.string().max(50).optional(), hidePrice: z.boolean().optional().default(false), isActive: z.boolean().optional().default(true), isPublished: z.boolean().optional().default(false), stockQuantity: z.number().int().min(0).optional().default(0), trackInventory: z.boolean().optional().default(true), lowStockThreshold: z.number().int().min(0).optional().default(5), allowBackorders: z.boolean().optional().default(false), weightValue: z.string().optional(), weightUnit: z.enum(["g","kg","oz","lb"]).optional(), lengthValue: z.string().optional(), widthValue: z.string().optional(), heightValue: z.string().optional(), dimensionUnit: z.enum(["mm","cm","m","in"]).optional(), volumeValue: z.string().optional(), volumeUnit: z.enum(["ml","l"]).optional(), sortOrder: z.number().int().optional().default(0) }` |
| Output | `Product` |
| Permissions | `["products:create"]` |
| aiExposure | `exposed` |
| risk | `write` |
| requiresConfirmation | `false` |
| Idempotent | `true` — key: client-supplied; scope: `company:<companyId>`; conflict: `IdempotencyConflictError` |
| Emits | `["catalog.productCreated"]` |
| Audit | `true` |
| auditTarget | `{ type: "product", id: output.id }` |
| Timeout | `5_000` |

**Handler logic:**
1. If `categoryId` provided, verify it belongs to `ctx.companyId`. Not found → `NotFoundError`.
2. If `unitTypeId` provided, verify it belongs to `ctx.companyId`. Not found → `NotFoundError`.
3. If `sku` omitted: load/upsert `company_sku_sequences` row, increment, generate SKU as zero-padded sequence number (e.g. `001`, `042`). Carried from v1 `trg_auto_generate_sku`.
4. Insert product. Unique `(company_id, sku)` violation → `ConflictError("SKU_TAKEN")`. Unique `(company_id, barcode)` violation → `ConflictError("BARCODE_TAKEN")`.
5. Emit `catalog.productCreated`.

---

#### `catalog.updateProduct`

| Field | Value |
| --- | --- |
| Name | `catalog.updateProduct` |
| Description | Update product details. To manage images, options, or variants, use dedicated actions. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ productId: z.string().uuid(), name: z.string().min(1).max(300).optional(), description: z.string().max(5000).nullable().optional(), basePriceMinor: z.string().optional(), currency: z.string().length(3).optional(), unitTypeId: z.string().uuid().nullable().optional(), categoryId: z.string().uuid().nullable().optional(), sku: z.string().min(1).max(50).optional(), barcode: z.string().max(50).nullable().optional(), hidePrice: z.boolean().optional(), isActive: z.boolean().optional(), isPublished: z.boolean().optional(), stockQuantity: z.number().int().min(0).optional(), trackInventory: z.boolean().optional(), lowStockThreshold: z.number().int().min(0).optional(), allowBackorders: z.boolean().optional(), weightValue: z.string().nullable().optional(), weightUnit: z.enum(["g","kg","oz","lb"]).nullable().optional(), lengthValue: z.string().nullable().optional(), widthValue: z.string().nullable().optional(), heightValue: z.string().nullable().optional(), dimensionUnit: z.enum(["mm","cm","m","in"]).nullable().optional(), volumeValue: z.string().nullable().optional(), volumeUnit: z.enum(["ml","l"]).nullable().optional(), sortOrder: z.number().int().optional() }` |
| Output | `Product` |
| Permissions | `["products:edit"]` |
| aiExposure | `exposed` |
| risk | `write` |
| requiresConfirmation | `false` |
| Idempotent | `true` — key: client-supplied; scope: `company:<companyId>` |
| Emits | `["catalog.productUpdated"]` |
| Audit | `true` |
| auditTarget | `{ type: "product", id: input.productId }` |
| Timeout | `5_000` |

**Handler logic:**
1. Load product with `FOR UPDATE`. Not found or wrong company → `NotFoundError`.
2. If changing `categoryId` or `unitTypeId`, verify the target belongs to `ctx.companyId`.
3. Apply partial update. SKU/barcode uniqueness violations → appropriate `ConflictError`.
4. Emit `catalog.productUpdated` (payload includes `changedFields` and publication state).

---

#### `catalog.deleteProduct`

| Field | Value |
| --- | --- |
| Name | `catalog.deleteProduct` |
| Description | Permanently delete a product and all its media, options, and variants. Associated pricing data cascades. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ productId: z.string().uuid() }` |
| Output | `{ deleted: z.literal(true) }` |
| Permissions | `["products:delete"]` |
| aiExposure | `exposed` |
| risk | `high` |
| requiresConfirmation | `true` |
| confirmationSummary | Returns product name, SKU, variant count, and number of pricing entries (via `ctx.call` or local count). |
| Idempotent | `true` — key: client-supplied; scope: `company:<companyId>`; replay: `{ deleted: true }` |
| Emits | `["catalog.productDeleted"]` |
| Audit | `true` |
| auditTarget | `{ type: "product", id: input.productId }` |
| Timeout | `10_000` |

**Handler logic:**
1. Load product. Not found → `NotFoundError`.
2. Delete product row. `ON DELETE CASCADE` propagates to `product_media`, `product_options`, `product_option_values`, `product_variants`, `product_variant_options`, and cascades to `price_list_entries`/`personal_prices` in pricing module.
3. Emit `catalog.productDeleted`.

---

#### `catalog.getProduct`

| Field | Value |
| --- | --- |
| Name | `catalog.getProduct` |
| Description | Get full product details including media, options, and variants. For staff panel display. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ productId: z.string().uuid() }` |
| Output | `Product.extend({ options: z.array(ProductOption), variants: z.array(ProductVariant), unitType: UnitType.nullable(), category: ProductCategory.nullable() })` |
| Permissions | `["products:view"]` |
| aiExposure | `exposed` |
| risk | `read` |
| requiresConfirmation | `false` |
| Idempotent | `false` |
| Emits | `[]` |
| Audit | `false` |
| Timeout | `3_000` |

---

#### `catalog.listProducts`

| Field | Value |
| --- | --- |
| Name | `catalog.listProducts` |
| Description | List products for this company with filtering and cursor pagination. Staff panel view. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ categoryId: z.string().uuid().optional(), isActive: z.boolean().optional(), isPublished: z.boolean().optional(), query: z.string().max(200).optional(), cursor: z.string().optional(), limit: z.number().int().min(1).max(100).optional().default(50) }` |
| Output | `{ products: z.array(ProductSummary), nextCursor: z.string().nullable() }` |
| Permissions | `["products:view"]` |
| aiExposure | `exposed` |
| risk | `read` |
| requiresConfirmation | `false` |
| Idempotent | `false` |
| Emits | `[]` |
| Audit | `false` |
| Timeout | `5_000` |

**Handler:** Filter by `ctx.companyId`, optionally by category, active/published status. Optional `query` performs name `ILIKE` search. Cursor-based pagination by `(sort_order, created_at, id)`.

---

### 3.4 Product media

---

#### `catalog.setProductMedia`

| Field | Value |
| --- | --- |
| Name | `catalog.setProductMedia` |
| Description | Replace all media for a product with the provided set. Validates file ownership via files module. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ productId: z.string().uuid(), media: z.array(z.object({ fileId: z.string().uuid(), displayOrder: z.number().int().min(1), isPrimary: z.boolean().optional().default(false) })).max(20) }` |
| Output | `{ media: z.array(ProductMedia) }` |
| Permissions | `["products:edit"]` |
| aiExposure | `exposed` |
| risk | `write` |
| requiresConfirmation | `false` |
| Idempotent | `true` — key: client-supplied; scope: `company:<companyId>` |
| Emits | `[]` |
| Audit | `true` |
| auditTarget | `{ type: "product", id: input.productId }` |
| Timeout | `5_000` |
| Calls (`ctx.call`) | `files.getAttachmentFacts` (validate file ownership) |

**Handler logic:**
1. Load product. Not found → `NotFoundError`.
2. Validate exactly zero or one `isPrimary: true` entry. More than one → `ValidationError`.
3. For each `fileId`, verify it belongs to the company via `ctx.call` to `files.getAttachmentFacts`.
4. Delete all existing `product_media` rows for the product.
5. Insert new rows. Atomic replace in one transaction.

---

### 3.5 Product options and variants

---

#### `catalog.setProductOptions`

| Field | Value |
| --- | --- |
| Name | `catalog.setProductOptions` |
| Description | Replace all options (and their values) for a product. Existing variants that reference removed options/values are deleted. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ productId: z.string().uuid(), options: z.array(z.object({ name: z.string().min(1).max(100), sortOrder: z.number().int().optional().default(0), values: z.array(z.object({ value: z.string().min(1).max(100), sortOrder: z.number().int().optional().default(0) })).min(1).max(50) })).max(5) }` |
| Output | `{ options: z.array(ProductOption) }` |
| Permissions | `["products:edit"]` |
| aiExposure | `exposed` |
| risk | `write` |
| requiresConfirmation | `false` |
| Idempotent | `true` — key: client-supplied; scope: `company:<companyId>` |
| Emits | `[]` |
| Audit | `true` |
| auditTarget | `{ type: "product", id: input.productId }` |
| Timeout | `10_000` |

**Handler logic:**
1. Load product. Not found → `NotFoundError`.
2. Validate unique option names within the set. Duplicates → `ValidationError`.
3. Validate unique values within each option. Duplicates → `ValidationError`.
4. Delete all existing options (cascades to values, variant options, and orphaned variants).
5. Insert new options and values.

---

#### `catalog.setProductVariants`

| Field | Value |
| --- | --- |
| Name | `catalog.setProductVariants` |
| Description | Replace all variants for a product. Each variant is a combination of option values. Product must have options defined first. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ productId: z.string().uuid(), variants: z.array(z.object({ optionValues: z.array(z.object({ optionId: z.string().uuid(), optionValueId: z.string().uuid() })).min(1), sku: z.string().max(50).optional(), basePriceMinor: z.string().optional(), currency: z.string().length(3).optional(), weightValue: z.string().optional(), weightUnit: z.enum(["g","kg","oz","lb"]).optional(), stockQuantity: z.number().int().min(0).optional().default(0), trackInventory: z.boolean().optional().default(true), allowBackorders: z.boolean().optional().default(false), isActive: z.boolean().optional().default(true), sortOrder: z.number().int().optional().default(0) })).max(100) }` |
| Output | `{ variants: z.array(ProductVariant) }` |
| Permissions | `["products:edit"]` |
| aiExposure | `exposed` |
| risk | `write` |
| requiresConfirmation | `false` |
| Idempotent | `true` — key: client-supplied; scope: `company:<companyId>` |
| Emits | `[]` |
| Audit | `true` |
| auditTarget | `{ type: "product", id: input.productId }` |
| Timeout | `10_000` |

**Handler logic:**
1. Load product and its options/values. Not found → `NotFoundError`.
2. Verify `optionValues` reference valid options and values for this product. Invalid references → `ValidationError`.
3. Verify no duplicate option-value combinations across variants. Duplicates → `ValidationError`.
4. Each variant must cover all defined options (one value per option). Missing → `ValidationError`.
5. Delete all existing variants (cascades to `product_variant_options` and to `price_list_entries`/`personal_prices` in pricing module via FK cascade).
6. Insert new variants and their option junctions.

---

#### `catalog.updateVariant`

| Field | Value |
| --- | --- |
| Name | `catalog.updateVariant` |
| Description | Update a single variant's SKU, price override, inventory, weight, or active status. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ variantId: z.string().uuid(), sku: z.string().max(50).nullable().optional(), basePriceMinor: z.string().nullable().optional(), currency: z.string().length(3).nullable().optional(), weightValue: z.string().nullable().optional(), weightUnit: z.enum(["g","kg","oz","lb"]).nullable().optional(), stockQuantity: z.number().int().min(0).optional(), trackInventory: z.boolean().optional(), allowBackorders: z.boolean().optional(), isActive: z.boolean().optional(), sortOrder: z.number().int().optional() }` |
| Output | `ProductVariant` |
| Permissions | `["products:edit"]` |
| aiExposure | `exposed` |
| risk | `write` |
| requiresConfirmation | `false` |
| Idempotent | `true` — key: client-supplied; scope: `company:<companyId>` |
| Emits | `[]` |
| Audit | `true` |
| auditTarget | `{ type: "product_variant", id: input.variantId }` |
| Timeout | `5_000` |

**Handler:** Load variant within `ctx.companyId`. Not found → `NotFoundError`. SKU uniqueness violation → `ConflictError("VARIANT_SKU_TAKEN")`. Price/currency consistency enforced.

---

### 3.6 Product publication lifecycle

---

#### `catalog.publishProduct`

| Field | Value |
| --- | --- |
| Name | `catalog.publishProduct` |
| Description | Publish a product, making it visible in consumer discovery (when the owning company is also published). |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ productId: z.string().uuid() }` |
| Output | `{ id: z.string().uuid(), isPublished: z.literal(true) }` |
| Permissions | `["products:edit"]` |
| aiExposure | `exposed` |
| risk | `write` |
| requiresConfirmation | `false` |
| Idempotent | `true` — key: client-supplied; scope: `company:<companyId>`; replay if already published |
| Emits | `["catalog.productPublished"]` |
| Audit | `true` |
| auditTarget | `{ type: "product", id: input.productId }` |
| Timeout | `5_000` |

**Handler:** Load product. Not found → `NotFoundError`. Product must be active to publish; inactive → `ValidationError("PRODUCT_MUST_BE_ACTIVE_TO_PUBLISH")`. Already published → idempotent replay. Set `is_published = true`. Emit `catalog.productPublished`.

---

#### `catalog.unpublishProduct`

| Field | Value |
| --- | --- |
| Name | `catalog.unpublishProduct` |
| Description | Unpublish a product, hiding it from consumer discovery. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ productId: z.string().uuid() }` |
| Output | `{ id: z.string().uuid(), isPublished: z.literal(false) }` |
| Permissions | `["products:edit"]` |
| aiExposure | `exposed` |
| risk | `write` |
| requiresConfirmation | `false` |
| Idempotent | `true` — key: client-supplied; scope: `company:<companyId>`; replay if already unpublished |
| Emits | `["catalog.productUnpublished"]` |
| Audit | `true` |
| auditTarget | `{ type: "product", id: input.productId }` |
| Timeout | `5_000` |

---

#### `catalog.bulkUpdateProductStatus`

| Field | Value |
| --- | --- |
| Name | `catalog.bulkUpdateProductStatus` |
| Description | Activate, deactivate, publish, or unpublish multiple products at once. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ productIds: z.array(z.string().uuid()).min(1).max(100), isActive: z.boolean().optional(), isPublished: z.boolean().optional() }` |
| Output | `{ updatedCount: z.number().int() }` |
| Permissions | `["products:edit"]` |
| aiExposure | `exposed` |
| risk | `write` |
| requiresConfirmation | `false` |
| Idempotent | `true` — key: client-supplied; scope: `company:<companyId>` |
| Emits | `["catalog.productsStatusChanged"]` |
| Audit | `true` |
| auditTarget | `{ type: "product_batch", id: "<companyId>" }` |
| Timeout | `10_000` |

**Handler:** Update only products belonging to `ctx.companyId`. If `isActive: false` and `isPublished` is not explicitly set, automatically set `isPublished = false` (deactivation implies unpublication). Emit `catalog.productsStatusChanged`.

---

### 3.7 Consumer discovery reads (ADR-0018)

---

#### `catalog.getPublishedProduct`

| Field | Value |
| --- | --- |
| Name | `catalog.getPublishedProduct` |
| Description | Consumer discovery read: get a single active published product by ID, including its media, variants, and unit type. Only returns products of published companies. |
| Principal | `consumer` |
| Transport | `client` |
| Input | `{ productId: z.string().uuid() }` |
| Output | `ConsumerProductDetail` (see below) |
| Permissions | `[]` |
| aiExposure | `exposed` |
| risk | `read` |
| requiresConfirmation | `false` |
| Idempotent | `false` |
| Emits | `[]` |
| Audit | `false` |
| Timeout | `3_000` |
| Calls (`ctx.call`) | `companies.getPublishedCompany` (verify company is published) |

```ts
const ConsumerProductDetail = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  basePriceMinor: z.string(),
  currency: z.string().length(3),
  hidePrice: z.boolean(),
  sku: z.string(),
  categoryName: z.string().nullable(),
  unitTypeCode: z.string().nullable(),
  unitTypeName: z.string().nullable(),
  unitTypeSymbol: z.string().nullable(),
  media: z.array(ProductMedia),
  weightValue: z.string().nullable(),
  weightUnit: z.string().nullable(),
  lengthValue: z.string().nullable(),
  widthValue: z.string().nullable(),
  heightValue: z.string().nullable(),
  dimensionUnit: z.string().nullable(),
  volumeValue: z.string().nullable(),
  volumeUnit: z.string().nullable(),
  stockQuantity: z.number().int(),
  trackInventory: z.boolean(),
  hasVariants: z.boolean(),
  variants: z.array(z.object({
    id: z.string().uuid(),
    sku: z.string().nullable(),
    basePriceMinor: z.string().nullable(),
    currency: z.string().length(3).nullable(),
    weightValue: z.string().nullable(),
    weightUnit: z.string().nullable(),
    stockQuantity: z.number().int(),
    trackInventory: z.boolean(),
    isActive: z.boolean(),
    options: z.array(z.object({
      optionName: z.string(),
      value: z.string(),
    })),
  })),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
```

**Handler logic:**
1. Load product by ID. Not found, not active, or not published → `NotFoundError` (no existence leak).
2. Verify the owning company is published via `ctx.call` to `companies.getPublishedCompany`. Unpublished company → `NotFoundError`.
3. Return product with active variants, media, unit type, and category name. Only active variants are returned.

---

#### `catalog.listPublishedProducts`

| Field | Value |
| --- | --- |
| Name | `catalog.listPublishedProducts` |
| Description | Consumer discovery read: list active published products for a published company, with category filter and cursor pagination. |
| Principal | `consumer` |
| Transport | `client` |
| Input | `{ companyId: z.string().uuid(), categoryId: z.string().uuid().optional(), cursor: z.string().optional(), limit: z.number().int().min(1).max(50).optional().default(20) }` |
| Output | `{ products: z.array(ConsumerProductCard), nextCursor: z.string().nullable() }` |
| Permissions | `[]` |
| aiExposure | `exposed` |
| risk | `read` |
| requiresConfirmation | `false` |
| Idempotent | `false` |
| Emits | `[]` |
| Audit | `false` |
| Timeout | `5_000` |
| Calls (`ctx.call`) | `companies.getPublishedCompany` (verify company is published) |

```ts
const ConsumerProductCard = z.object({
  id: z.string().uuid(),
  name: z.string(),
  basePriceMinor: z.string(),
  currency: z.string().length(3),
  hidePrice: z.boolean(),
  categoryName: z.string().nullable(),
  unitTypeCode: z.string().nullable(),
  unitTypeSymbol: z.string().nullable(),
  primaryMediaFileId: z.string().uuid().nullable(),
  hasVariants: z.boolean(),
  stockQuantity: z.number().int(),
  trackInventory: z.boolean(),
  updatedAt: z.string().datetime(),
});
```

**Handler logic:**
1. Verify company is published via `ctx.call` to `companies.getPublishedCompany`. Not published → `NotFoundError`.
2. Query products where `company_id = input.companyId AND is_active = true AND is_published = true`.
3. Optionally filter by `categoryId`. Cursor-based pagination by `(sort_order, created_at, id)`.

---

### 3.8 Customer-scoped reads

---

#### `catalog.listCompanyProducts`

| Field | Value |
| --- | --- |
| Name | `catalog.listCompanyProducts` |
| Description | List active products for a company from the customer's perspective. Only active products are shown; publication status is not filtered (customers with direct access can see active unpublished products). |
| Principal | `customer` |
| Transport | `client` |
| resolveTarget | Receives `{ companyId }` from input; loads company via `companies.getVisibleToUser`; verifies published and not deleted; returns `{ companyId, resource: { companyId } }`. |
| Input | `{ companyId: z.string().uuid(), categoryId: z.string().uuid().optional(), cursor: z.string().optional(), limit: z.number().int().min(1).max(50).optional().default(20) }` |
| Output | `{ products: z.array(ConsumerProductCard), nextCursor: z.string().nullable() }` |
| Permissions | `[]` |
| aiExposure | `internal` |
| risk | `read` |
| requiresConfirmation | `false` |
| Idempotent | `false` |
| Emits | `[]` |
| Audit | `false` |
| Timeout | `5_000` |
| Calls (`ctx.call`) | `companies.getVisibleToUser` (resolveTarget) |

**Handler:** Query products where `company_id = resolved.companyId AND is_active = true`. Customer sees active products regardless of publication status (they have a direct relationship). Cursor pagination.

---

### 3.9 Public reads

---

#### `catalog.getProductBySlug`

| Field | Value |
| --- | --- |
| Name | `catalog.getProductBySlug` |
| Description | Get a single active published product by company slug and product ID for direct-link previews. |
| Principal | `public` |
| Transport | `client` |
| resolveTarget | Receives `{ companySlug, productId }` from input; loads company by slug, proves `publication_status = 'published' AND deleted_at IS NULL`; loads product, proves `is_active = true AND is_published = true`; returns `{ companyId, resource: { product } }`. Not found/unpublished → `NotFoundError`. |
| Input | `{ companySlug: z.string(), productId: z.string().uuid() }` |
| Output | `ConsumerProductDetail` |
| Permissions | `[]` |
| aiExposure | `exposed` |
| risk | `read` |
| requiresConfirmation | `false` |
| Idempotent | `false` |
| Emits | `[]` |
| Audit | `false` |
| Timeout | `3_000` |

---

### 3.10 Cross-module read actions (composition contract fulfillment)

---

#### `catalog.getProductPricingFacts`

| Field | Value |
| --- | --- |
| Name | `catalog.getProductPricingFacts` |
| Description | Get product pricing facts for price resolution: base prices and variant base prices. Used by pricing module via ctx.call. |
| Principal | `staff` |
| Transport | `internal` |
| Input | `{ productIds: z.array(z.string().uuid()).min(1).max(200) }` |
| Output | `{ products: z.array(z.object({ productId: z.string().uuid(), companyId: z.string().uuid(), basePriceMinor: z.string(), currency: z.string().length(3), variants: z.array(z.object({ variantId: z.string().uuid(), basePriceMinor: z.string().nullable(), currency: z.string().length(3).nullable() })) })) }` |
| Permissions | `["products:view"]` |
| aiExposure | `internal` |
| risk | `read` |
| requiresConfirmation | `false` |
| Idempotent | `false` |
| Emits | `[]` |
| Audit | `false` |
| Timeout | `3_000` |

**Handler:** Load products by IDs within `ctx.companyId`. Products not belonging to the company are silently excluded (no existence leak). Returns base prices and all active variant base prices. This fulfills the composition contract declared in pricing.md §11.

---

#### `catalog.getProductPricingFactsCustomer`

| Field | Value |
| --- | --- |
| Name | `catalog.getProductPricingFactsCustomer` |
| Description | Customer-compatible variant of getProductPricingFacts for pricing.resolveMyProductPrices. |
| Principal | `customer` |
| Transport | `internal` |
| resolveTarget | Receives `{ productIds }` from input; loads the company from the first product and verifies it is visible to the customer; returns `{ companyId, resource: { companyId } }`. |
| Input | `{ productIds: z.array(z.string().uuid()).min(1).max(200) }` |
| Output | Same as `catalog.getProductPricingFacts` |
| Permissions | `[]` |
| aiExposure | `internal` |
| risk | `read` |
| requiresConfirmation | `false` |
| Idempotent | `false` |
| Emits | `[]` |
| Audit | `false` |
| Timeout | `3_000` |

Shares the same service as `catalog.getProductPricingFacts`.

---

#### `catalog.getProductPricingFactsPublic`

| Field | Value |
| --- | --- |
| Name | `catalog.getProductPricingFactsPublic` |
| Description | Public variant of getProductPricingFacts for pricing.resolvePublicProductPrices. |
| Principal | `public` |
| Transport | `internal` |
| resolveTarget | Receives `{ companySlug, productIds }` from input; loads company by slug; proves it is public/published; returns `{ companyId, resource: { companyId } }`. |
| Input | `{ companySlug: z.string(), productIds: z.array(z.string().uuid()).min(1).max(200) }` |
| Output | Same as `catalog.getProductPricingFacts` |
| Permissions | `[]` |
| aiExposure | `internal` |
| risk | `read` |
| requiresConfirmation | `false` |
| Idempotent | `false` |
| Emits | `[]` |
| Audit | `false` |
| Timeout | `3_000` |

---

#### `catalog.getProductFacts`

| Field | Value |
| --- | --- |
| Name | `catalog.getProductFacts` |
| Description | Get product facts for order creation: name, SKU, unit type, active status. Used by orders module via ctx.call. |
| Principal | `staff` |
| Transport | `internal` |
| Input | `{ productIds: z.array(z.string().uuid()).min(1).max(200) }` |
| Output | `{ products: z.array(z.object({ productId: z.string().uuid(), companyId: z.string().uuid(), name: z.string(), sku: z.string(), unitTypeCode: z.string().nullable(), unitTypeSymbol: z.string().nullable(), isActive: z.boolean(), trackInventory: z.boolean(), stockQuantity: z.number().int(), variants: z.array(z.object({ variantId: z.string().uuid(), sku: z.string().nullable(), isActive: z.boolean(), trackInventory: z.boolean(), stockQuantity: z.number().int(), options: z.array(z.object({ optionName: z.string(), value: z.string() })) })) })) }` |
| Permissions | `["products:view"]` |
| aiExposure | `internal` |
| risk | `read` |
| requiresConfirmation | `false` |
| Idempotent | `false` |
| Emits | `[]` |
| Audit | `false` |
| Timeout | `3_000` |

---

#### `catalog.getProductFactsSystem`

| Field | Value |
| --- | --- |
| Name | `catalog.getProductFactsSystem` |
| Description | System-internal variant of getProductFacts for event consumers and workers. |
| Principal | `system` |
| Transport | `internal` |
| systemScope | `tenant` |
| Input | Same as `catalog.getProductFacts` |
| Output | Same as `catalog.getProductFacts` |
| Permissions | `[]` |
| aiExposure | `internal` |
| risk | `read` |
| requiresConfirmation | `false` |
| Idempotent | `false` |
| Emits | `[]` |
| Audit | `false` |
| Timeout | `3_000` |

Shares the same service with `catalog.getProductFacts`.

---

## 4. Events

### 4.1 Emitted

All events are tenant-scoped. Envelope version `1`.

| Event | Aggregate | Payload | Expected subscribers |
| --- | --- | --- | --- |
| `catalog.productCreated` | `{ type: "product", id }` | `{ companyId, productId, name, sku, isActive, isPublished }` | `search` (add to projection if published) |
| `catalog.productUpdated` | `{ type: "product", id }` | `{ companyId, productId, changedFields: string[], isActive, isPublished }` | `search` (rebuild projection if published; remove if unpublished/deactivated) |
| `catalog.productPublished` | `{ type: "product", id }` | `{ companyId, productId, name }` | `search` (add to projection) |
| `catalog.productUnpublished` | `{ type: "product", id }` | `{ companyId, productId }` | `search` (remove from projection) |
| `catalog.productDeleted` | `{ type: "product", id }` | `{ companyId, productId, sku }` | `search` (remove from projection) |
| `catalog.productsStatusChanged` | `{ type: "product_batch", id: companyId }` | `{ companyId, productIds: string[], isActive, isPublished }` | `search` (rebuild projections) |

### 4.2 Consumed

None at launch. The catalog module does not subscribe to other modules'
events.

### 4.3 Read-model grants

| Grantee | Tables | Access | Purpose |
| --- | --- | --- | --- |
| `search` | `products`, `product_categories`, `product_media` | SELECT (read-only foreign schema import) | Rebuild published-product FTS/trigram projections with category names and primary image |

The `search` module spec must declare its use of these grants. `search`
projections are not domain authority (ADR-0011/0015).

## 5. State machines and concurrency

### 5.1 Product active/published lifecycle

```
Created (is_active=true, is_published=false)
    │
    ▼
  active + unpublished ──publishProduct──▸ active + published
                                              │
                                              ▼
                                    unpublishProduct
                                              │
                                              ▼
                                    active + unpublished
    │
    ▼
  deactivate (updateProduct: is_active=false)
    → automatically sets is_published=false
    │
    ▼
  inactive + unpublished ──activate (updateProduct: is_active=true)──▸ active + unpublished
                                    (must explicitly re-publish)
```

**Invariants:**
- An inactive product is always unpublished. Setting `is_active = false`
  via `updateProduct` or `bulkUpdateProductStatus` automatically clears
  `is_published = false`.
- Publishing requires the product to be active. Attempting to publish an
  inactive product → `ValidationError`.
- A published product is visible in consumer discovery only when the owning
  company is also published (checked at read time, not enforced as a state
  constraint).

### 5.2 Concurrent edits

- `updateProduct` acquires a row-level `FOR UPDATE` lock on the product row.
  Concurrent updates serialize cleanly.
- `setProductOptions` and `setProductVariants` are atomic replace operations
  within one transaction. Concurrent calls serialize on the product-level
  lock.
- `bulkUpdateProductStatus` updates all matching products in a single
  statement; concurrent bulk operations on overlapping products serialize on
  row-level locks.

### 5.3 SKU generation

The `company_sku_sequences` table is updated with `INSERT ... ON CONFLICT
DO UPDATE SET next_val = next_val + 1 RETURNING next_val - 1`. This acquires
a row-level lock, serializing concurrent product creations for the same
company and preventing duplicate SKUs. This replaces the v1
`trg_auto_generate_sku` trigger.

### 5.4 Primary image invariant

The partial unique index `(product_id) WHERE is_primary = true` enforces at
most one primary image per product at the DB level.
`catalog.setProductMedia` validates this before insertion; the index is a
backstop.

## 6. Edge cases

1. **Duplicate category name** — Unique `(company_id, name)` constraint
   surfaces `ConflictError("CATEGORY_NAME_TAKEN")`. (v1:
   `idx_product_categories_company_name` unique index.)

2. **Duplicate unit type code** — Unique `(company_id, code)` constraint
   surfaces `ConflictError("UNIT_CODE_TAKEN")`. (v1: `unit_types` unique
   constraint.)

3. **Duplicate SKU** — Unique `(company_id, sku)` constraint surfaces
   `ConflictError("SKU_TAKEN")`. v1 auto-generated SKUs with
   `trg_auto_generate_sku`; v2 moves this to the handler.

4. **Duplicate barcode** — Unique `(company_id, barcode) WHERE barcode IS
   NOT NULL` surfaces `ConflictError("BARCODE_TAKEN")`. (v1:
   `idx_products_company_barcode`.)

5. **Product with variants deleted** — `ON DELETE CASCADE` propagates from
   `products` to `product_options`, `product_option_values`,
   `product_variants`, `product_variant_options`, `product_media`. Pricing
   module's `price_list_entries` and `personal_prices` cascade via FK on
   `product_id`/`variant_id`.

6. **Options replaced with incompatible set** — `setProductOptions` deletes
   all existing options (cascading to values and variant junctions). Orphaned
   variants are automatically deleted because `product_variant_options` rows
   cascade from `product_options`. The handler then creates new options.

7. **Variant references invalid option/value** — `setProductVariants`
   validates all option/value references before insertion. Invalid
   references → `ValidationError`.

8. **Deactivating a published product** — `updateProduct` with
   `isActive: false` automatically sets `is_published = false` and emits
   `catalog.productUpdated` with both changes.

9. **Publishing an inactive product** — `publishProduct` returns
   `ValidationError("PRODUCT_MUST_BE_ACTIVE_TO_PUBLISH")`.

10. **Consumer reads unpublished product** — `getPublishedProduct` and
    `listPublishedProducts` filter on `is_active = true AND is_published =
    true`. Unpublished products → `NotFoundError` (no existence leak).

11. **Consumer reads product of unpublished company** —
    `getPublishedProduct` calls `companies.getPublishedCompany`; unpublished
    company → `NotFoundError`.

12. **Cross-company product IDs in pricing facts** —
    `getProductPricingFacts` filters by `ctx.companyId`; products belonging
    to another company are silently excluded (no existence leak).

13. **Multiple primary images** — `setProductMedia` validates at most one
    `isPrimary: true`. The partial unique index is the DB backstop.

14. **Empty variant option coverage** — `setProductVariants` requires each
    variant to have exactly one value per defined option. Partial coverage →
    `ValidationError`.

15. **Deleting a category with products** — `ON DELETE SET NULL` on
    `products.category_id` nullifies the reference; products are not deleted.

16. **Deleting a unit type with products** — `ON DELETE SET NULL` on
    `products.unit_type_id` nullifies the reference; products are not deleted.

17. **Concurrent SKU auto-generation** — Two concurrent `createProduct`
    calls without explicit SKU: the `INSERT ... ON CONFLICT DO UPDATE`
    on `company_sku_sequences` serializes on row-level lock; each gets a
    unique sequence number.

18. **Variant SKU conflicts across variants** — Unique
    `(company_id, sku) WHERE sku IS NOT NULL` applies to variant SKUs the
    same as product SKUs. Collision → `ConflictError("VARIANT_SKU_TAKEN")`.

## 7. v1 migration notes

V2 starts with a **clean database** (no product/category/image row import
for launch). These notes serve as behavioral reference and schema
reconciliation. The migration approach mirrors the companies spec: v1 is
behavioral reference, not a data source.

### 7.1 Tables

#### `product_categories` → `product_categories` (TRANSFORM)

Source migration: `20260301000007_products.sql`, Part 1.

| v1 column | v2 column | Transform |
| --- | --- | --- |
| `id uuid` | `id uuid` | Direct copy |
| `company_id uuid` | `company_id uuid` | Direct copy |
| `name text` | `name text` | Direct copy |
| `created_at timestamptz` | `created_at timestamptz` | Direct copy |
| `updated_at timestamptz` | `updated_at timestamptz` | Direct copy |
| — | `sort_order integer` | New column, default `0` |

**Cleanup:** verify no orphan categories (company_id FK valid).

#### `unit_types` → `unit_types` (TRANSFORM)

Source migration: `20260301000007_products.sql`, Part 2.

| v1 column | v2 column | Transform |
| --- | --- | --- |
| `id uuid` | `id uuid` | Direct copy |
| `company_id uuid` | `company_id uuid` | Direct copy |
| `code text` | `code text` | Direct copy |
| `name text` | `name text` | Direct copy |
| `symbol text` | `symbol text` | Direct copy |
| `is_default boolean` | `is_default boolean` | Direct copy |
| `sort_order integer` | `sort_order integer` | Direct copy |
| `created_at timestamptz` | `created_at timestamptz` | Direct copy |
| `updated_at timestamptz` | `updated_at timestamptz` | Direct copy |

No column changes. Schema structurally identical.

#### `products` → `products` (TRANSFORM)

Source migrations: `20260301000007_products.sql` Part 3, `20260311000002_product_specifications_and_variants.sql` Part 1, `20260317000001_payments_fiscal_checkout.sql` Part 2.

| v1 column | v2 column | Transform |
| --- | --- | --- |
| `id uuid` | `id uuid` | Direct copy |
| `company_id uuid` | `company_id uuid` | Direct copy |
| `name text` | `name text` | Direct copy |
| `description text` | `description text` | Direct copy |
| `price numeric(10,2)` | `base_price_minor bigint` | `ROUND(price * 100)::bigint` |
| — | `currency char(3)` | Set to `'UAH'` |
| `unit_type_id uuid` | `unit_type_id uuid` | Direct copy |
| `category_id uuid` | `category_id uuid` | Direct copy |
| `sku text` | `sku text` | Direct copy |
| `barcode text` | `barcode text` | Direct copy |
| `hide_price boolean` | `hide_price boolean` | Direct copy |
| `status_id uuid` | `is_active boolean` | `true` if status code = `'active'`; `false` otherwise |
| — | `is_published boolean` | All migrated products set to `false` (requires explicit publish) |
| `stock_quantity integer` | `stock_quantity integer` | Direct copy |
| `track_inventory boolean` | `track_inventory boolean` | Direct copy |
| `low_stock_threshold integer` | `low_stock_threshold integer` | Direct copy |
| `allow_backorders boolean` | `allow_backorders boolean` | Direct copy |
| `weight_value numeric(10,4)` | `weight_value numeric(10,4)` | Direct copy |
| `weight_unit text` | `weight_unit text` | Direct copy |
| `length_value numeric(10,4)` | `length_value numeric(10,4)` | Direct copy |
| `width_value numeric(10,4)` | `width_value numeric(10,4)` | Direct copy |
| `height_value numeric(10,4)` | `height_value numeric(10,4)` | Direct copy |
| `dimension_unit text` | `dimension_unit text` | Direct copy |
| `volume_value numeric(10,4)` | `volume_value numeric(10,4)` | Direct copy |
| `volume_unit text` | `volume_unit text` | Direct copy |
| — | `sort_order integer` | New column, default `0` |
| `created_at timestamptz` | `created_at timestamptz` | Direct copy |
| `updated_at timestamptz` | `updated_at timestamptz` | Direct copy |
| `image_url text` | — | DROP; replaced by `product_media.file_id` |
| `likes_count int` | — | DROP (social dropped) |
| `embedding vector(1536)` | — | DROP (vector search dropped) |
| `fts tsvector` | — | DROP (FTS → search projections) |
| `uktzed text` | — | DEFER to acquiring module |

#### `product_images` → `product_media` (TRANSFORM)

Source migration: `20260301000007_products.sql`, Part 4.

| v1 column | v2 column | Transform |
| --- | --- | --- |
| `id uuid` | `id uuid` | Direct copy |
| `product_id uuid` | `product_id uuid` | Direct copy |
| `company_id uuid` | `company_id uuid` | Direct copy |
| `image_url text` | `file_id uuid` | Requires file-module migration: import image URL → S3, create `files` record, use its ID |
| `display_order integer` | `display_order integer` | Direct copy |
| `is_primary boolean` | `is_primary boolean` | Direct copy |
| `created_at timestamptz` | `created_at timestamptz` | Direct copy |
| `updated_at timestamptz` | `updated_at timestamptz` | Direct copy |

#### `product_options` → `product_options` (TRANSFORM)

Source migration: `20260311000002_product_specifications_and_variants.sql`, Part 2.

| v1 column | v2 column | Transform |
| --- | --- | --- |
| `id uuid` | `id uuid` | Direct copy |
| `product_id uuid` | `product_id uuid` | Direct copy |
| `company_id uuid` | `company_id uuid` | Direct copy |
| `name text` | `name text` | Direct copy |
| `sort_order integer` | `sort_order integer` | Direct copy |
| `created_at timestamptz` | `created_at timestamptz` | Direct copy |
| `updated_at timestamptz` | `updated_at timestamptz` | Direct copy |

New index: unique `(product_id, name)`.

#### `product_option_values` → `product_option_values` (TRANSFORM)

Source migration: `20260311000002_product_specifications_and_variants.sql`, Part 2.

| v1 column | v2 column | Transform |
| --- | --- | --- |
| `id uuid` | `id uuid` | Direct copy |
| `option_id uuid` | `option_id uuid` | Direct copy |
| `value text` | `value text` | Direct copy |
| `sort_order integer` | `sort_order integer` | Direct copy |
| `created_at timestamptz` | `created_at timestamptz` | Direct copy |
| `updated_at timestamptz` | `updated_at timestamptz` | Direct copy |

New index: unique `(option_id, value)`.

#### `product_variants` → `product_variants` (TRANSFORM)

Source migration: `20260311000002_product_specifications_and_variants.sql`, Part 3.

| v1 column | v2 column | Transform |
| --- | --- | --- |
| `id uuid` | `id uuid` | Direct copy |
| `product_id uuid` | `product_id uuid` | Direct copy |
| `company_id uuid` | `company_id uuid` | Direct copy |
| `sku text` | `sku text` | Direct copy |
| — | `base_price_minor bigint` | New (v1 had no variant-level base price) |
| — | `currency char(3)` | New |
| `weight_value numeric(10,4)` | `weight_value numeric(10,4)` | Direct copy |
| `weight_unit text` | `weight_unit text` | Direct copy |
| `stock_quantity integer` | `stock_quantity integer` | Direct copy |
| `track_inventory boolean` | `track_inventory boolean` | Direct copy |
| `allow_backorders boolean` | `allow_backorders boolean` | Direct copy |
| `is_active boolean` | `is_active boolean` | Direct copy |
| `sort_order integer` | `sort_order integer` | Direct copy |
| `created_at timestamptz` | `created_at timestamptz` | Direct copy |
| `updated_at timestamptz` | `updated_at timestamptz` | Direct copy |

#### `product_variant_options` → `product_variant_options` (TRANSFORM)

Source migration: `20260311000002_product_specifications_and_variants.sql`, Part 3.

Schema is structurally identical. No column changes.

#### `company_sku_sequences` → `company_sku_sequences` (TRANSFORM)

Source migration: `20260317000001_payments_fiscal_checkout.sql`, Part 4.

Schema is structurally identical. v1 trigger `trg_auto_generate_sku` moves
to `catalog.createProduct` handler.

#### Dropped tables

| v1 table | Decision | Reason |
| --- | --- | --- |
| `product_comments` | DROP | Social mechanics dropped (scope §5, ADR-0018) |
| `product_likes` | DROP | Social mechanics dropped (scope §5, ADR-0018) |

### 7.2 Views

| v1 view | Decision | v2 target |
| --- | --- | --- |
| `products_view` | TRANSFORM | `catalog.listProducts` and `catalog.getProduct` staff reads |
| `consumer_products_view` | DROP | Published product behavior → `catalog.getPublishedProduct`, `catalog.listPublishedProducts` consumer reads + `search` FTS projections (ADR-0018) |
| `product_comments_view` | DROP | Dropped with comments |

### 7.3 Functions and RPCs

| v1 function | Decision | v2 target |
| --- | --- | --- |
| `trg_auto_generate_sku()` | MOVE | `catalog.createProduct` handler (SKU generation service) |
| `trg_update_products_count()` | DROP | `products_count` counter column dropped from companies |
| `get_company_products(...)` | TRANSFORM | `catalog.listPublishedProducts` (consumer) + `catalog.listCompanyProducts` (customer) |
| `get_products_by_ids(...)` | TRANSFORM | `catalog.getProductFacts` (internal reads for orders/chat) |
| `get_company_page(...)` (products portion) | TRANSFORM | `catalog.listPublishedProducts` (product portion of company page) |
| `assistant_search_products(...)` | TRANSFORM | `catalog.listProducts` with query filter (staff AI search) |

### 7.4 Triggers

| v1 trigger | Decision | v2 location |
| --- | --- | --- |
| `trigger_update_product_categories_timestamp` | KEEP | Shared `updated_at` trigger (db.md §5) |
| `set_unit_types_updated_at` | KEEP | Shared `updated_at` trigger |
| `trigger_update_products_timestamp` | KEEP | Shared `updated_at` trigger |
| `trigger_update_product_images_timestamp` | KEEP | Shared `updated_at` trigger |
| `trigger_update_product_options_timestamp` | KEEP | Shared `updated_at` trigger |
| `trigger_update_product_option_values_timestamp` | KEEP | Shared `updated_at` trigger |
| `trigger_update_product_variants_timestamp` | KEEP | Shared `updated_at` trigger |
| `trg_products_auto_sku` | MOVE | `catalog.createProduct` handler |
| `trg_products_count` | DROP | Counter column dropped |
| `trg_likes_count` | DROP | Likes dropped |

### 7.5 RLS policies

All v1 RLS policies on catalog-owned tables are **dropped**. Authorization
maps to v2 actions:

| v1 policy | v2 action / check |
| --- | --- |
| `product_categories: public read` | Consumer: `catalog.listPublishedProducts` returns category names inline. Customer/public reads include category names. Staff: `catalog.listCategories` (`products:view`) |
| `product_categories: member insert/update/delete` | `catalog.createCategory`/`updateCategory`/`deleteCategory` (`categories:manage`) |
| `unit_types: member select` | `catalog.listUnitTypes` (`products:view`) |
| `unit_types: member insert/update/delete` | `catalog.createUnitType`/`updateUnitType`/`deleteUnitType` (`settings:units`) |
| `products: public read` | Published-only via consumer reads (ADR-0018 tightens v1's unrestricted public read). Customer reads verify company visibility. Public reads verify publication. |
| `products: member insert` | `catalog.createProduct` (`products:create`) |
| `products: member update` | `catalog.updateProduct` (`products:edit`) |
| `products: member delete` | `catalog.deleteProduct` (`products:delete`) |
| `product_images: public read` | Media included inline in product reads |
| `product_images: member insert/update/delete` | `catalog.setProductMedia` (`products:edit`) |
| `product_options: public read` | Options included inline in product reads |
| `product_options: member insert/update/delete` | `catalog.setProductOptions` (`products:edit` for write; `products:create` not needed separately) |
| `product_option_values: public/member *` | Managed through `catalog.setProductOptions` |
| `product_variants: public read` | Variants included inline in product reads |
| `product_variants: member insert/update/delete` | `catalog.setProductVariants`/`updateVariant` (`products:edit`) |
| `product_variant_options: public/member *` | Managed through `catalog.setProductVariants` |
| `company_sku_sequences: RLS` | Internal to `catalog.createProduct` handler; no client access |

### 7.6 Seed and cutover (clean database)

1. Run drizzle-kit migration creating all catalog-owned tables.
2. No product/category/unit-type data import.
3. Rollback: drop tables and re-run migration. No v1 data at risk.

## 8. Non-functional requirements

- **Batch product queries.** `listProducts`, `listPublishedProducts`, and
  pricing facts reads must handle up to 200 products per query without N+1.
  Implementation uses JOINs for media/category/unit-type data, not per-row
  queries.
- **Image count limit.** Max 20 media items per product (enforced by action
  input validation).
- **Option/variant limits.** Max 5 option groups per product, max 50 values
  per option, max 100 variants per product (enforced by input validation).
  These limits prevent combinatorial explosion.
- **No PII in audit.** Product data is not PII. Audit uses default
  hash-only policy for auditTarget.
- **Expected volumes.** Typical company: 50–500 products, 0–5 categories,
  2–5 unit types, 0–20 images per product, 0–3 options per product, 0–50
  variants per product. Consumer discovery queries are the highest-volume
  read path.
- **Rate limits.** Core defaults apply. Consumer discovery reads
  (`getPublishedProduct`, `listPublishedProducts`) at 60/min per user
  (core.md §10). Public direct-link reads at 30/min per IP.
- **PII in logs.** No PII fields in catalog tables; standard structured
  logging applies.

## 9. Acceptance criteria

Mandatory minimum (inherited from template):

- [ ] Cross-tenant isolation for staff actions: membership of company A
      cannot access/modify catalog data of company B (inherited
      `crossTenantSuite`).
- [ ] Customer `resolveTarget` in `listCompanyProducts` returns
      `NotFoundError` for unpublished/deleted/foreign companies with no
      existence leak.
- [ ] Consumer actions (`getPublishedProduct`, `listPublishedProducts`):
      contract check rejects `resolveTarget`; published-only access (no
      unpublished entities); no CRM creation/side effects; `audit: false`
      and `emits: []`; instantiate inherited `consumerIsolationSuite`.
- [ ] Public `getProductBySlug`: `resolveTarget` proves company is
      published and product is active+published; unpublished →
      `NotFoundError`.
- [ ] Authorization denial: missing `products:view`/`products:create`/
      `products:edit`/`products:delete`/`categories:manage`/`settings:units`
      → `PermissionDeniedError`.
- [ ] Validation failures surface typed `ValidationError` (invalid price,
      duplicate option names, incomplete variant coverage, etc.).
- [ ] Output validates at runtime and is JSON-safe (money as decimal string
      on the wire, not JSON number).
- [ ] Idempotency (`idempotencySuite`) on all declared idempotent writes:
      replay returns stored result; same-key/different-payload → conflict.
- [ ] Declared events emit transactionally (`eventSuite`); a failed handler
      rolls back events, audit, and data changes.
- [ ] Audit records written for every `audit: true` action.

Module-specific:

- [ ] **SKU auto-generation.** Creating a product without explicit SKU
      generates a unique sequential SKU (e.g. `001`, `042`). Concurrent
      creates for the same company produce unique SKUs (no gaps required,
      but no duplicates).
- [ ] **SKU/barcode uniqueness.** Duplicate SKU within a company →
      `ConflictError("SKU_TAKEN")`; duplicate barcode →
      `ConflictError("BARCODE_TAKEN")`.
- [ ] **Product publication lifecycle.** Deactivating a published product
      automatically unpublishes it. Publishing an inactive product is
      rejected. Consumer reads never surface inactive or unpublished
      products.
- [ ] **Company publication gate.** Consumer reads verify the owning
      company is published. Products of unpublished companies are invisible
      to consumers even if the product itself is active+published.
- [ ] **Variant completeness.** `setProductVariants` rejects variants that
      do not cover all defined options. Duplicate option-value combinations
      are rejected.
- [ ] **Option/variant cascade.** Replacing options via `setProductOptions`
      deletes orphaned variants. Deleting a product cascades to all options,
      values, variants, variant-options, and media.
- [ ] **Pricing cascade.** Deleting a product/variant cascades to
      `price_list_entries` and `personal_prices` in the pricing module via
      FK cascade.
- [ ] **Primary image invariant.** At most one primary image per product;
      partial unique index is the DB backstop.
- [ ] **Category/unit-type deletion.** Deleting a category/unit-type sets
      the FK to null on products, not deleting products.
- [ ] **Cross-module `ctx.call` targets.** `getProductPricingFacts` returns
      correct base prices and variant base prices; the shape matches
      pricing.md §11 expectations. `getProductFacts` returns product facts
      expected by orders.
- [ ] **Bulk status update.** `bulkUpdateProductStatus` correctly
      deactivates/activates/publishes/unpublishes up to 100 products.
      Deactivation implies unpublication.
- [ ] **Consumer vs. customer read scope.** Consumer reads filter on
      `is_active AND is_published` and verify company publication. Customer
      reads filter on `is_active` only (customers see active unpublished
      products of companies they have access to).

## 10. Resolved decisions

1. **Separate `is_active`/`is_published` instead of v1 `status_id`** —
   v1 used `company_statuses` with a single `active` status; v2 uses
   explicit booleans for clarity and to support the publication lifecycle
   (owner, 2026-08-17).
2. **Product media via files module** — v1 stored `image_url` directly;
   v2 references `files.id` for S3-backed storage with signed URLs
   (owner, 2026-08-17).
3. **Variant base price** — v1 had no variant-level base price; v2 adds
   `base_price_minor` on `product_variants` as an optional override.
   Pricing resolution uses variant base price → product base price
   fallback (owner, 2026-08-17).
4. **`uktzed` deferred** — UKT ZED fiscal classification deferred to
   `acquiring` module. Not needed at launch (owner, 2026-08-17).
5. **No product comments/likes** — Social mechanics dropped per scope §5
   and ADR-0018 (owner, 2026-08-17).
6. **Clean database** — No v1 product/category/image row migration; v1
   is behavioral reference only (owner, 2026-08-17).
7. **Atomic replace for options/variants/media** — Staff actions use
   delete-all + insert pattern rather than granular CRUD for options,
   variants, and media. Simpler mental model; no stale orphan risk.
   Individual variant updates via `updateVariant` for common use cases
   (stock, price override) (owner, 2026-08-17).

## 11. Composition contract (callee capabilities this module provides)

| Caller | Action | Principal compat | What caller needs |
| --- | --- | --- | --- |
| `pricing` | `catalog.getProductPricingFacts` | `staff` | Product IDs → `{ productId, companyId, basePriceMinor, currency, variants: [{ variantId, basePriceMinor }] }`. Verifies products belong to resolved company. |
| `pricing` | `catalog.getProductPricingFactsCustomer` | `customer` | Same shape as above, customer-compatible |
| `pricing` | `catalog.getProductPricingFactsPublic` | `public` | Same shape as above, public-compatible |
| `orders` | `catalog.getProductFacts` | `staff` | Product IDs → name, SKU, unit type, active status, inventory, variant details |
| `orders` | `catalog.getProductFactsSystem` | `system` | Same shape as above for system callers |
| `chat` | `catalog.getProductFacts` | `staff` | Product facts for product cards in chat |
| `search` | read-model grants (§4.3) | — | Projection rebuild from products/categories/media tables |

### Outbound `ctx.call` dependencies

| Callee | Action (expected) | Principal compat | What catalog needs |
| --- | --- | --- | --- |
| `companies` | `companies.getPublishedCompany` | `consumer` | Verify company is published for consumer product reads |
| `companies` | `companies.getVisibleToUser` | `customer` | Company visibility for customer product reads (resolveTarget) |
| `files` | `files.getAttachmentFacts` (future files spec) | `staff` | File ownership validation in `setProductMedia` |

## Changelog

| Date | Change | Why | Reported by |
| --- | --- | --- | --- |
| 2026-08-17 | Initial draft | Spec-rework queue Step 3b: full catalog module | spec agent |
