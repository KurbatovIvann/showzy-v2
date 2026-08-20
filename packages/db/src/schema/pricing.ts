/**
 * Price resolution tables (SHO-85, pricing-T1). Owned by the pricing module
 * (ADR-0014). Levels of the resolution chain (feature card):
 * personal → customer's list → group's list → company default list → base.
 * Prices are integer minor units (`_minor` bigint + currency, db.md §3);
 * zero is a valid price.
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  check,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { products, productVariants } from "./catalog.js";
import { companies } from "./companies.js";
import { companyCustomers } from "./customers.js";

/**
 * Named price tiers. At most one default list per company (partial unique);
 * inactive lists are skipped at every resolution level.
 */
export const priceLists = pgTable(
  "price_lists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    isActive: boolean("is_active").notNull().default(true),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("price_lists_company_idx").on(table.companyId),
    uniqueIndex("price_lists_company_default_uq")
      .on(table.companyId)
      .where(sql`${table.isDefault} = true`),
  ],
);

/**
 * Per-list prices at product or variant granularity (levels 2–4). Within a
 * level a variant entry beats a product entry. One product-level entry per
 * (list, product) and one variant-level entry per (list, product, variant)
 * — the two partial unique indexes. Rows are dependent pricing state:
 * deleting the list, product, or variant cascades here (feature card
 * "FK cascades"; resolution never reads stale entries).
 */
export const priceListEntries = pgTable(
  "price_list_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    priceListId: uuid("price_list_id")
      .notNull()
      .references(() => priceLists.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, {
      onDelete: "cascade",
    }),
    priceMinor: bigint("price_minor", { mode: "bigint" }).notNull(),
    currency: char("currency", { length: 3 }).notNull().default("UAH"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("price_list_entries_company_idx").on(table.companyId),
    index("price_list_entries_price_list_idx").on(table.priceListId),
    index("price_list_entries_product_idx").on(table.productId),
    index("price_list_entries_variant_idx").on(table.variantId),
    uniqueIndex("price_list_entries_list_product_uq")
      .on(table.priceListId, table.productId)
      .where(sql`${table.variantId} IS NULL`),
    uniqueIndex("price_list_entries_list_variant_uq")
      .on(table.priceListId, table.productId, table.variantId)
      .where(sql`${table.variantId} IS NOT NULL`),
    check(
      "price_list_entries_price_minor_check",
      sql`${table.priceMinor} >= 0`,
    ),
  ],
);

/**
 * Level-1 personal prices for a named CRM customer, at product or variant
 * granularity. One product-level row per (customer, product) and one
 * variant-level row per (customer, product, variant) — the other two
 * partial unique indexes. Dependent pricing state: deleting the customer,
 * product, or variant cascades here (feature card "FK cascades").
 */
export const personalPrices = pgTable(
  "personal_prices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => companyCustomers.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, {
      onDelete: "cascade",
    }),
    priceMinor: bigint("price_minor", { mode: "bigint" }).notNull(),
    currency: char("currency", { length: 3 }).notNull().default("UAH"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("personal_prices_company_idx").on(table.companyId),
    index("personal_prices_customer_idx").on(table.customerId),
    index("personal_prices_product_idx").on(table.productId),
    index("personal_prices_variant_idx").on(table.variantId),
    uniqueIndex("personal_prices_customer_product_uq")
      .on(table.customerId, table.productId)
      .where(sql`${table.variantId} IS NULL`),
    uniqueIndex("personal_prices_customer_variant_uq")
      .on(table.customerId, table.productId, table.variantId)
      .where(sql`${table.variantId} IS NOT NULL`),
    check("personal_prices_price_minor_check", sql`${table.priceMinor} >= 0`),
  ],
);
