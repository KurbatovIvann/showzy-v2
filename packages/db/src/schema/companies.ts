/**
 * Phase-0 tenant and RBAC identity (companies-foundation.md). This file is
 * owned by the companies module even though the scaffold creates it before
 * module actions exist (ADR-0014). Profile, publication, taxonomy, and legal
 * fields belong to the later full companies schema task.
 */
import { sql } from "drizzle-orm";
import {
  check,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { userIdColumn } from "./auth-ids.js";
import { user } from "./auth.js";

export interface CompanyMemberPermissions {
  granted: string[];
  denied: string[];
}

const emptyPermissions: CompanyMemberPermissions = {
  granted: [],
  denied: [],
};

/** Tenant root. Profile and discovery columns intentionally do not exist yet. */
export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    prefix: text("prefix").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("companies_slug_uq").on(table.slug),
    uniqueIndex("companies_prefix_uq").on(table.prefix),
  ],
);

/**
 * Verified staff membership and per-member permission overrides. Tenant
 * authority is derived from a row matching both userId and companyId; a
 * caller-supplied company selector is never authority by itself.
 */
export const companyMembers = pgTable(
  "company_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    userId: userIdColumn("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    role: text("role").notNull(),
    permissions: jsonb("permissions")
      .$type<CompanyMemberPermissions>()
      .notNull()
      .default(emptyPermissions),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("company_members_company_user_uq").on(
      table.companyId,
      table.userId,
    ),
    index("company_members_user_company_idx").on(table.userId, table.companyId),
    index("company_members_company_role_idx").on(table.companyId, table.role),
    check(
      "company_members_role_check",
      sql`${table.role} IN ('owner', 'admin', 'manager', 'employee')`,
    ),
  ],
);

/**
 * Global default grants. Owners short-circuit to all known permissions;
 * other roles fall back to this table after explicit deny/grant overrides.
 */
export const rolePermissionDefaults = pgTable(
  "role_permission_defaults",
  {
    role: text("role").notNull(),
    permission: text("permission").notNull(),
  },
  (table) => [
    primaryKey({
      name: "role_permission_defaults_pk",
      columns: [table.role, table.permission],
    }),
  ],
);
