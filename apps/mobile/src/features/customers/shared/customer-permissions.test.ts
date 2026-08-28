import { describe, expect, it } from "vitest";

import {
  canCreateCustomers,
  canDeleteCustomers,
  canEditCustomers,
} from "./customer-permissions";

/**
 * Mirrors `packages/db/seed/role-permission-defaults.ts`: employees
 * hold `customers:view` only; managers hold create/edit; only owner
 * (implicit) and admin hold `customers:delete`. UI affordance only —
 * the server re-checks permissions.
 */
describe("customer permission affordances", () => {
  it("hides the clients create control only for employees", () => {
    expect(canCreateCustomers("owner")).toBe(true);
    expect(canCreateCustomers("admin")).toBe(true);
    expect(canCreateCustomers("manager")).toBe(true);
    expect(canCreateCustomers("employee")).toBe(false);
  });

  it("hides archive/restore, edit, group writes, and counterparty writes only for employees", () => {
    expect(canEditCustomers("owner")).toBe(true);
    expect(canEditCustomers("admin")).toBe(true);
    expect(canEditCustomers("manager")).toBe(true);
    expect(canEditCustomers("employee")).toBe(false);
  });

  it("hides customer hard-delete for manager and employee", () => {
    expect(canDeleteCustomers("owner")).toBe(true);
    expect(canDeleteCustomers("admin")).toBe(true);
    expect(canDeleteCustomers("manager")).toBe(false);
    expect(canDeleteCustomers("employee")).toBe(false);
  });
});
