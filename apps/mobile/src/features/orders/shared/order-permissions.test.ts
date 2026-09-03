import { describe, expect, it } from "vitest";

import {
  canCreateOrders,
  canEditOrders,
  canFetchFileDownloadUrls,
  orderCreateScreenActions,
  orderDetailActions,
  orderDetailPrimaryWrite,
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

  it("skips thumbnail URL fetches without files:view", () => {
    expect(canFetchFileDownloadUrls("owner")).toBe(true);
    expect(canFetchFileDownloadUrls("admin")).toBe(true);
    expect(canFetchFileDownloadUrls("manager")).toBe(true);
    expect(canFetchFileDownloadUrls("employee")).toBe(false);
  });

  it("hides the plus control when orders:create is not granted", () => {
    expect(ordersHeaderActions({ canCreate: false })).toEqual({
      showCreate: false,
    });
    expect(ordersHeaderActions({ canCreate: true })).toEqual({
      showCreate: true,
    });
  });

  it("hides the create submit when orders:create is not granted", () => {
    expect(orderCreateScreenActions({ canCreate: false })).toEqual({
      showSubmit: false,
    });
    expect(orderCreateScreenActions({ canCreate: true })).toEqual({
      showSubmit: true,
    });
  });

  it("shows status writes for every seeded role that holds orders:edit", () => {
    expect(canEditOrders("owner")).toBe(true);
    expect(canEditOrders("admin")).toBe(true);
    expect(canEditOrders("manager")).toBe(true);
    expect(canEditOrders("employee")).toBe(true);
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

  it("maps one primary CTA per open status and enables cancel only while open", () => {
    expect(orderDetailPrimaryWrite("new")).toBe("confirm");
    expect(orderDetailPrimaryWrite("confirmed")).toBe("start");
    expect(orderDetailPrimaryWrite("in_progress")).toBe("complete");
    expect(orderDetailPrimaryWrite("done")).toBeNull();
    expect(orderDetailPrimaryWrite("canceled")).toBeNull();

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
      showActions: true,
      cancelEnabled: false,
    });
    expect(orderDetailActions({ canEdit: true, status: "canceled" })).toEqual({
      showConfirm: false,
      showStart: false,
      showComplete: false,
      showActions: true,
      cancelEnabled: false,
    });
  });
});
