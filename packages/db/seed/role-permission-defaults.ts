import type { Database } from "../src/client.js";
import { rolePermissionDefaults } from "../src/schema/companies.js";

/**
 * Phase-0 defaults carried from the v1 permission model. This deliberately
 * seeds only the catalog permissions present in the foundation/reference
 * path; later module schema tasks extend the table alongside their actions.
 * Owners are absent because they implicitly hold every known permission.
 */
export const rolePermissionDefaultRows = [
  { role: "admin", permission: "products:view" },
  { role: "admin", permission: "products:create" },
  { role: "admin", permission: "products:edit" },
  { role: "admin", permission: "products:delete" },
  { role: "manager", permission: "products:view" },
  { role: "manager", permission: "products:create" },
  { role: "manager", permission: "products:edit" },
  { role: "employee", permission: "products:view" },
] satisfies readonly (typeof rolePermissionDefaults.$inferInsert)[];

/** Inserts missing defaults and leaves existing rows unchanged. */
export async function seedRolePermissionDefaults(db: Database) {
  return db
    .insert(rolePermissionDefaults)
    .values([...rolePermissionDefaultRows])
    .onConflictDoNothing()
    .returning();
}
