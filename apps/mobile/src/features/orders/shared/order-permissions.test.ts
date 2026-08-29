import { describe, expect, it } from "vitest";

import { canCreateOrders, ordersHeaderActions } from "./order-permissions";

/**
 * Mirrors `packages/db/seed/role-permission-defaults.ts`: every staff
 * role holds `orders:view` and `orders:create`; owners hold everything
 * implicitly. UI affordance only — the server re-checks permissions.
 */
describe("order permission affordances", () => {
  it("shows the create control for every seeded role that holds orders:create", () => {
    expect(canCreateOrders("owner")).toBe(true);
    expect(canCreateOrders("admin")).toBe(true);
    expect(canCreateOrders("manager")).toBe(true);
    expect(canCreateOrders("employee")).toBe(true);
  });

  it("hides the plus control when orders:create is not granted", () => {
    expect(ordersHeaderActions({ canCreate: false })).toEqual({
      showCreate: false,
    });
    expect(ordersHeaderActions({ canCreate: true })).toEqual({
      showCreate: true,
    });
  });
});
