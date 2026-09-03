import { describe, expect, it } from "vitest";

import {
  canCreateOrders,
  canEditOrders,
  orderCreateScreenActions,
  orderDetailActions,
  orderDetailPrimaryWrite,
} from "./order-permissions";

/**
 * Mirrors `packages/db/seed/role-permission-defaults.ts`: every staff
 * role holds `orders:edit`; owners hold everything implicitly. UI
 * affordance only — the server re-checks permissions.
 */
describe("order create permission affordances (SHO-379)", () => {
  it("shows create for every seeded role that holds orders:create", () => {
    expect(canCreateOrders("owner")).toBe(true);
    expect(canCreateOrders("admin")).toBe(true);
    expect(canCreateOrders("manager")).toBe(true);
    expect(canCreateOrders("employee")).toBe(true);
    expect(orderCreateScreenActions({ canCreate: true })).toEqual({
      showSubmit: true,
    });
  });

  it("hides create submit when orders:create is not granted", () => {
    expect(orderCreateScreenActions({ canCreate: false })).toEqual({
      showSubmit: false,
    });
  });
});

describe("order detail permission affordances (SHO-378)", () => {
  it("shows status writes for every seeded role that holds orders:edit", () => {
    expect(canEditOrders("owner")).toBe(true);
    expect(canEditOrders("admin")).toBe(true);
    expect(canEditOrders("manager")).toBe(true);
    expect(canEditOrders("employee")).toBe(true);
  });

  it("maps one primary write per open status and none on terminal", () => {
    expect(orderDetailPrimaryWrite("new")).toBe("confirm");
    expect(orderDetailPrimaryWrite("confirmed")).toBe("start");
    expect(orderDetailPrimaryWrite("in_progress")).toBe("complete");
    expect(orderDetailPrimaryWrite("done")).toBeNull();
    expect(orderDetailPrimaryWrite("canceled")).toBeNull();
  });

  it("hides every write when orders:edit is not granted", () => {
    const hidden = {
      showConfirm: false,
      showStart: false,
      showComplete: false,
      showActions: false,
      cancelEnabled: false,
    };
    expect(orderDetailActions({ canEdit: false, status: "new" })).toEqual(
      hidden,
    );
    expect(orderDetailActions({ canEdit: false, status: "confirmed" })).toEqual(
      hidden,
    );
    expect(
      orderDetailActions({ canEdit: false, status: "in_progress" }),
    ).toEqual(hidden);
    expect(orderDetailActions({ canEdit: false, status: "done" })).toEqual(
      hidden,
    );
    expect(orderDetailActions({ canEdit: false, status: "canceled" })).toEqual(
      hidden,
    );
  });

  it("shows confirm / start / complete and cancel on the matching open status", () => {
    expect(orderDetailActions({ canEdit: true, status: "new" })).toEqual({
      showConfirm: true,
      showStart: false,
      showComplete: false,
      showActions: true,
      cancelEnabled: true,
    });
    expect(orderDetailActions({ canEdit: true, status: "confirmed" })).toEqual({
      showConfirm: false,
      showStart: true,
      showComplete: false,
      showActions: true,
      cancelEnabled: true,
    });
    expect(
      orderDetailActions({ canEdit: true, status: "in_progress" }),
    ).toEqual({
      showConfirm: false,
      showStart: false,
      showComplete: true,
      showActions: true,
      cancelEnabled: true,
    });
    expect(orderDetailActions({ canEdit: true, status: "done" })).toEqual({
      showConfirm: false,
      showStart: false,
      showComplete: false,
      showActions: false,
      cancelEnabled: false,
    });
    expect(orderDetailActions({ canEdit: true, status: "canceled" })).toEqual({
      showConfirm: false,
      showStart: false,
      showComplete: false,
      showActions: false,
      cancelEnabled: false,
    });
  });
});
