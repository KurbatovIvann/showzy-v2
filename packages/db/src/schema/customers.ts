/**
 * Minimal CRM slice for price resolution (SHO-85, pricing-T1). Owned by the
 * customers module (ADR-0014). Only the pricing assignments the resolver
 * needs exist here (group and price-list links); identity/contact columns
 * arrive with the full customers schema task.
 */
import {
  foreignKey,
  index,
  pgTable,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { companies } from "./companies.js";
import { priceLists } from "./pricing.js";

/**
 * Customer segmentation groups carrying the level-3 price-list assignment.
 * Deleting a price list unlinks the group (SET NULL) so resolution falls
 * through to the next level instead of blocking pricing-owned deletes.
 */
export const customerGroups = pgTable(
  "customer_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    priceListId: uuid("price_list_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("customer_groups_company_id_id_uq").on(table.companyId, table.id),
    index("customer_groups_company_idx").on(table.companyId),
    index("customer_groups_price_list_idx").on(table.priceListId),
    // Getter defers the customers ↔ pricing import cycle (ADR-0025).
    // ON DELETE SET NULL is scoped to price_list_id in 0011 (db.md §7).
    foreignKey({
      name: "customer_groups_price_lists_company_fk",
      columns: [table.companyId, table.priceListId],
      get foreignColumns(): [
        typeof priceLists.companyId,
        typeof priceLists.id,
      ] {
        return [priceLists.companyId, priceLists.id];
      },
    }).onDelete("set null"),
  ],
);

/**
 * Company CRM customer records carrying the level-2 price-list assignment
 * and the group membership used at level 3. Deleting a group or a price
 * list unlinks (SET NULL) — resolution falls through to lower levels.
 */
export const companyCustomers = pgTable(
  "company_customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    groupId: uuid("group_id"),
    priceListId: uuid("price_list_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("company_customers_company_id_id_uq").on(table.companyId, table.id),
    index("company_customers_company_idx").on(table.companyId),
    index("company_customers_group_idx").on(table.groupId),
    index("company_customers_price_list_idx").on(table.priceListId),
    foreignKey({
      name: "company_customers_customer_groups_company_fk",
      columns: [table.companyId, table.groupId],
      foreignColumns: [customerGroups.companyId, customerGroups.id],
    }).onDelete("set null"),
    // Getter defers the customers ↔ pricing import cycle (ADR-0025).
    // ON DELETE SET NULL is scoped to price_list_id in 0011 (db.md §7).
    foreignKey({
      name: "company_customers_price_lists_company_fk",
      columns: [table.companyId, table.priceListId],
      get foreignColumns(): [
        typeof priceLists.companyId,
        typeof priceLists.id,
      ] {
        return [priceLists.companyId, priceLists.id];
      },
    }).onDelete("set null"),
  ],
);
