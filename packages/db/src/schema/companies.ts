/**
 * Companies-owned tenant identity, membership/RBAC, and 1:1 seller legal
 * requisites (companies-foundation.md, SHO-222). This file is owned by the
 * companies module (ADR-0014). Profile, publication, and taxonomy columns
 * remain later; do not add them here.
 */
import { sql } from "drizzle-orm";
import {
  check,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { userIdColumn } from "./auth-ids.js";
import { user } from "./auth.js";
import {
  tenantCompanyId,
  tenantRowUnique,
  timestampColumns,
} from "./tenant-columns.js";

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
    ...timestampColumns(),
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
    companyId: tenantCompanyId(),
    userId: userIdColumn("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    role: text("role").notNull(),
    permissions: jsonb("permissions")
      .$type<CompanyMemberPermissions>()
      .notNull()
      .default(emptyPermissions),
    ...timestampColumns(),
  },
  (table) => [
    tenantRowUnique("company_members_company_id_id_uq", table),
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
 * Seller legal requisites for documents (SHO-222 / SHO-223). One optional
 * row per company: absence means legal is not yet filled. Not the public
 * profile and not the buyer face (`counterparties` /
 * `customer_legal_profiles`).
 */
export const companyLegalInfo = pgTable(
  "company_legal_info",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: tenantCompanyId(),
    companyType: text("company_type").notNull().default("fop"),
    legalName: text("legal_name"),
    edrpou: text("edrpou"),
    legalAddress: text("legal_address"),
    iban: text("iban"),
    bankName: text("bank_name"),
    bankMfo: text("bank_mfo"),
    bankEdrpou: text("bank_edrpou"),
    phone: text("phone"),
    email: text("email"),
    ...timestampColumns(),
  },
  (table) => [
    unique("company_legal_info_company_id_uq").on(table.companyId),
    tenantRowUnique("company_legal_info_company_id_id_uq", table),
    check(
      "company_legal_info_company_type_check",
      sql`${table.companyType} IN ('fop', 'tov')`,
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
