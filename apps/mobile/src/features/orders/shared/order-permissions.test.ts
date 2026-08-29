import { describe, expect, it } from "vitest";

import {
  canCreateOrders,
  canEditOrders,
  orderDetailActions,
  ordersHeaderActions,
} from "./order-permissions";

/**
 * Mirrors `packages/db/seed/role-permission-defaults.ts`: every staff
 * role holds `orders:view`, `orders:create`, and `orders:edit`; owners
 * hold everything implicitly. UI affordance only — the server
 * re-checks permissions.
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

  it("shows confirm/cancel for every seeded role that holds orders:edit", () => {
    expect(canEditOrders("owner")).toBe(true);
    expect(canEditOrders("admin")).toBe(true);
    expect(canEditOrders("manager")).toBe(true);
    expect(canEditOrders("employee")).toBe(true);
  });

  it("hides confirm and cancel when orders:edit is not granted", () => {
    expect(orderDetailActions({ canEdit: false, status: "new" })).toEqual({
      showConfirm: false,
      showActions: false,
      cancelEnabled: false,
    });
    expect(orderDetailActions({ canEdit: false, status: "confirmed" })).toEqual(
      {
        showConfirm: false,
        showActions: false,
        cancelEnabled: false,
      },
    );
  });

  it("shows confirm only for new and disables cancel when canceled", () => {
    expect(orderDetailActions({ canEdit: true, status: "new" })).toEqual({
      showConfirm: true,
      showActions: true,
      cancelEnabled: true,
    });
    expect(orderDetailActions({ canEdit: true, status: "confirmed" })).toEqual({
      showConfirm: false,
      showActions: true,
      cancelEnabled: true,
    });
    expect(orderDetailActions({ canEdit: true, status: "canceled" })).toEqual({
      showConfirm: false,
      showActions: true,
      cancelEnabled: false,
    });
  });
});
