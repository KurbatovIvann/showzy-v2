import type { Database } from "../src/client.js";
import { rolePermissionDefaults } from "../src/schema/companies.js";

/**
 * Phase-0 defaults carried from the v1 permission model. Catalog, customers,
 * pricing, and orders keys land here; later module schema tasks extend the
 * table alongside their actions. Owners are absent because they implicitly
 * hold every known permission.
 */
export const rolePermissionDefaultRows = [
  { role: "admin", permission: "products:view" },
  { role: "admin", permission: "products:create" },
  { role: "admin", permission: "products:edit" },
  { role: "admin", permission: "products:delete" },
  { role: "admin", permission: "customers:view" },
  { role: "admin", permission: "pricing:view" },
  { role: "admin", permission: "orders:view" },
  { role: "admin", permission: "orders:create" },
  { role: "admin", permission: "orders:edit" },
  { role: "manager", permission: "products:view" },
  { role: "manager", permission: "products:create" },
  { role: "manager", permission: "products:edit" },
  { role: "manager", permission: "customers:view" },
  { role: "manager", permission: "pricing:view" },
  { role: "manager", permission: "orders:view" },
  { role: "manager", permission: "orders:create" },
  { role: "manager", permission: "orders:edit" },
  { role: "employee", permission: "products:view" },
  { role: "employee", permission: "customers:view" },
  { role: "employee", permission: "pricing:view" },
  { role: "employee", permission: "orders:view" },
  { role: "employee", permission: "orders:create" },
  { role: "employee", permission: "orders:edit" },
] satisfies readonly (typeof rolePermissionDefaults.$inferInsert)[];

/** Inserts missing defaults and leaves existing rows unchanged. */
export async function seedRolePermissionDefaults(db: Database) {
  return db
    .insert(rolePermissionDefaults)
    .values([...rolePermissionDefaultRows])
    .onConflictDoNothing()
    .returning();
}
