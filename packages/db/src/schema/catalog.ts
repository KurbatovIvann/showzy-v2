/**
 * Minimal catalog slice for price resolution (SHO-85, pricing-T1) and
 * order-line titles (SHO-90, catalog-T2). Owned by the catalog module
 * (ADR-0014). Deliberately absent: sku/status/`is_active` — later catalog
 * schema tasks add those families.
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  char,
  check,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { companies } from "./companies.js";

/** Products carry the display name and the level-5 base price. */
export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    basePriceMinor: bigint("base_price_minor", { mode: "bigint" }).notNull(),
    currency: char("currency", { length: 3 }).notNull().default("UAH"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("products_company_id_id_uq").on(table.companyId, table.id),
    index("products_company_idx").on(table.companyId),
    check("products_base_price_minor_check", sql`${table.basePriceMinor} >= 0`),
  ],
);

/**
 * Variants carry an optional base-price override used at level 5 when set;
 * otherwise resolution falls back to the product base price. The override
 * price and its currency are set or null together (consistency CHECK).
 */
export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    // Same-module ownership: a product deletion removes its variants.
    productId: uuid("product_id").notNull(),
    name: text("name").notNull(),
    basePriceMinor: bigint("base_price_minor", { mode: "bigint" }),
    currency: char("currency", { length: 3 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("product_variants_company_id_id_uq").on(table.companyId, table.id),
    index("product_variants_company_idx").on(table.companyId),
    index("product_variants_product_idx").on(table.productId),
    foreignKey({
      name: "product_variants_products_company_fk",
      columns: [table.companyId, table.productId],
      foreignColumns: [products.companyId, products.id],
    }).onDelete("cascade"),
    check(
      "product_variants_base_price_minor_check",
      sql`${table.basePriceMinor} IS NULL OR ${table.basePriceMinor} >= 0`,
    ),
    check(
      "product_variants_price_currency_check",
      sql`(${table.basePriceMinor} IS NULL) = (${table.currency} IS NULL)`,
    ),
  ],
);
