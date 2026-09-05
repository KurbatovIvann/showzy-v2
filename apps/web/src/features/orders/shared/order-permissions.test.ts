import { describe, expect, it } from "vitest";

import {
  canCreateOrders,
  canEditOrders,
  canFetchFileDownloadUrls,
  membershipHasPermission,
  orderCreateScreenActions,
  orderDetailActions,
  orderDetailPrimaryWrite,
} from "./order-permissions";

const OWNER = { role: "owner" as const, permissions: [] };
const ADMIN_DEFAULTS = {
  role: "admin" as const,
  permissions: [
    "files:view",
    "orders:create",
    "orders:edit",
    "orders:view",
  ],
};
const MANAGER_DEFAULTS = {
  role: "manager" as const,
  permissions: [
    "files:view",
    "orders:create",
    "orders:edit",
    "orders:view",
  ],
};
const EMPLOYEE_DEFAULTS = {
  role: "employee" as const,
  permissions: ["orders:create", "orders:edit", "orders:view"],
};

describe("order create permission affordances (SHO-438)", () => {
  it("shows create for owner-all and seeded default roles that hold orders:create", () => {
    expect(canCreateOrders(OWNER)).toBe(true);
    expect(canCreateOrders(ADMIN_DEFAULTS)).toBe(true);
    expect(canCreateOrders(MANAGER_DEFAULTS)).toBe(true);
    expect(canCreateOrders(EMPLOYEE_DEFAULTS)).toBe(true);
    expect(orderCreateScreenActions({ canCreate: true })).toEqual({
      showSubmit: true,
    });
  });

  it("hides create when orders:create is denied or missing from a non-owner", () => {
    expect(
      canCreateOrders({
        role: "employee",
        permissions: ["orders:edit", "orders:view"],
      }),
    ).toBe(false);
    expect(canCreateOrders({ role: "employee" })).toBe(false);
    expect(canCreateOrders({ role: "admin" })).toBe(false);
    expect(orderCreateScreenActions({ canCreate: false })).toEqual({
      showSubmit: false,
    });
  });
});

describe("files:view download-url affordance", () => {
  it("lets owner-all and seeded roles with files:view fetch signed URLs", () => {
    expect(canFetchFileDownloadUrls(OWNER)).toBe(true);
    expect(canFetchFileDownloadUrls(ADMIN_DEFAULTS)).toBe(true);
    expect(canFetchFileDownloadUrls(MANAGER_DEFAULTS)).toBe(true);
  });

  it("skips getDownloadUrls without files:view and honors an explicit grant", () => {
    expect(canFetchFileDownloadUrls(EMPLOYEE_DEFAULTS)).toBe(false);
    expect(
      canFetchFileDownloadUrls({
        role: "employee",
        permissions: ["files:view", "orders:view"],
      }),
    ).toBe(true);
    expect(canFetchFileDownloadUrls({ role: "employee" })).toBe(false);
  });
});

describe("order detail permission affordances (SHO-438)", () => {
  it("shows status writes for owner-all and seeded roles that hold orders:edit", () => {
    expect(canEditOrders(OWNER)).toBe(true);
    expect(canEditOrders(ADMIN_DEFAULTS)).toBe(true);
    expect(canEditOrders(MANAGER_DEFAULTS)).toBe(true);
    expect(canEditOrders(EMPLOYEE_DEFAULTS)).toBe(true);
  });

  it("hides status writes when orders:edit is denied on the selected membership", () => {
    expect(
      canEditOrders({
        role: "manager",
        permissions: ["orders:create", "orders:view"],
      }),
    ).toBe(false);
    expect(
      canCreateOrders({
        role: "manager",
        permissions: ["orders:create", "orders:view"],
      }),
    ).toBe(true);
  });

  it("does not leak another company's capabilities through the helper", () => {
    const flowers = OWNER;
    const bakery = {
      role: "employee" as const,
      permissions: ["orders:view"],
    };
    expect(canCreateOrders(flowers)).toBe(true);
    expect(canEditOrders(flowers)).toBe(true);
    expect(canFetchFileDownloadUrls(flowers)).toBe(true);
    expect(canCreateOrders(bakery)).toBe(false);
    expect(canEditOrders(bakery)).toBe(false);
    expect(canFetchFileDownloadUrls(bakery)).toBe(false);
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

  it("treats unknown roles as a deny rather than granting every role", () => {
    expect(
      membershipHasPermission(
        { role: "superadmin", permissions: [] },
        "orders:create",
      ),
    ).toBe(false);
  });
});
