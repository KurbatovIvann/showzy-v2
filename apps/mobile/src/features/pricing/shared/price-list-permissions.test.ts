import { describe, expect, it } from "vitest";

import {
  canManagePriceLists,
  canViewPriceLists,
} from "./price-list-permissions";

/**
 * Mirrors `packages/db/seed/role-permission-defaults.ts`: employees
 * hold `pricing:view` only; admin and manager hold `pricing:manage`;
 * owners hold every permission implicitly. UI affordance only — the
 * server re-checks permissions.
 */
describe("price-list permission affordances", () => {
  it("lets every staff role list price lists", () => {
    expect(canViewPriceLists("owner")).toBe(true);
    expect(canViewPriceLists("admin")).toBe(true);
    expect(canViewPriceLists("manager")).toBe(true);
    expect(canViewPriceLists("employee")).toBe(true);
  });

  it("hides create, edit, default/active, and delete only for employees", () => {
    expect(canManagePriceLists("owner")).toBe(true);
    expect(canManagePriceLists("admin")).toBe(true);
    expect(canManagePriceLists("manager")).toBe(true);
    expect(canManagePriceLists("employee")).toBe(false);
  });
});
