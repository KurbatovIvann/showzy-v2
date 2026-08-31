/**
 * Order-card projection (SHO-93, chat-T1). Owned by the chat module
 * (ADR-0014). Cards store `order_id` + `revision` only — never order
 * status, totals, or other domain attributes (ADR-0011). Conversation
 * platform tables are out of this slice.
 */
import {
  foreignKey,
  index,
  integer,
  pgTable,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { orders } from "./orders.js";
import {
  tenantCompanyId,
  tenantRowUnique,
  timestampColumns,
} from "./tenant-columns.js";

/**
 * One projection row per order. `revision` is bumped by the later upsert
 * consumer; this schema task only persists the column.
 */
export const orderCards = pgTable(
  "order_cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: tenantCompanyId(),
    orderId: uuid("order_id").notNull(),
    revision: integer("revision").notNull().default(1),
    ...timestampColumns(),
  },
  (table) => [
    tenantRowUnique("order_cards_company_id_id_uq", table),
    unique("order_cards_order_id_uq").on(table.orderId),
    index("order_cards_company_updated_at_idx").on(
      table.companyId,
      table.updatedAt.desc(),
    ),
    foreignKey({
      name: "order_cards_orders_company_fk",
      columns: [table.companyId, table.orderId],
      foreignColumns: [orders.companyId, orders.id],
    }).onDelete("cascade"),
  ],
);
