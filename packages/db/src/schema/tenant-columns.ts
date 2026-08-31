/**
 * Shared tenant-row column helpers (SHO-294). Module schema files declare
 * `company_id`, `{ created_at, updated_at }`, and `UNIQUE (company_id, id)`
 * through these so the repeating Drizzle shape is written once.
 *
 * Do not use `tenantCompanyId` on `foundation.ts` (nullable `company_id`,
 * no FK). Do not use `timestampColumns` on snapshot/event tables that
 * only have `created_at`, on redemptions (no timestamps), or on
 * `order_number_counters`.
 */
import { getTableName } from "drizzle-orm";
import {
  timestamp,
  unique,
  uuid,
  type PgColumn,
  type UniqueConstraintBuilder,
} from "drizzle-orm/pg-core";

import { companies } from "./companies.js";

type TenantRow = {
  companyId: PgColumn;
  id: PgColumn;
};

/**
 * Column builder for module-owned tenant FKs to `companies`.
 * Every module `company_id` today is NOT NULL with ON DELETE CASCADE, so
 * the FK is part of the helper (unlike `userIdColumn`, whose ON DELETE
 * varies per table).
 */
export function tenantCompanyId() {
  return uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" });
}

/**
 * `{ createdAt, updatedAt }` both `timestamptz` notNull defaultNow.
 * Call only where both columns already exist.
 */
export function timestampColumns() {
  return {
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  };
}

/**
 * `UNIQUE (company_id, id)` with the existing `{table}_company_id_id_uq`
 * name so generate does not emit a rename.
 */
export function tenantRowUnique(table: TenantRow): UniqueConstraintBuilder;
export function tenantRowUnique(
  name: string,
  table: TenantRow,
): UniqueConstraintBuilder;
export function tenantRowUnique(
  nameOrTable: string | TenantRow,
  table?: TenantRow,
): UniqueConstraintBuilder {
  if (typeof nameOrTable !== "string") {
    return unique(
      `${getTableName(nameOrTable.companyId.table)}_company_id_id_uq`,
    ).on(nameOrTable.companyId, nameOrTable.id);
  }
  if (table === undefined) {
    throw new TypeError(
      `tenantRowUnique("${nameOrTable}", table) requires table columns`,
    );
  }
  return unique(nameOrTable).on(table.companyId, table.id);
}
