import { describe, expect, it } from "vitest";

import { ordersCopy } from "../../../i18n/orders";
import type { GetOrderOutput } from "../api/order-detail-query";
import {
  commentIfPresent,
  formatQuantityMilli,
  mapOrderWriteFailure,
  orderDetailActionsForView,
  orderDetailConfirmLoading,
  orderDetailHeaderTitle,
  orderDetailWriteChrome,
  orderWriteBanner,
  planOrderStatusWrite,
  toOrderDetailView,
} from "./order-detail-model";

const ORDER_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";
const CUSTOMER_ID = "11111111-1111-4111-8111-111111111111";
const ITEM_ID = "22222222-2222-4222-8222-222222222222";
const PRODUCT_ID = "33333333-3333-4333-8333-333333333333";

const LINE = {
  itemId: ITEM_ID,
  productId: PRODUCT_ID,
  variantId: null,
  titleSnapshot: "Торт «Київський»",
  quantityMilli: "2000",
  unitPriceMinor: "125000",
  discountKind: "none" as const,
  discountValue: "0",
  discountAmountMinor: "0",
  taxTreatment: "exempt" as const,
  taxRateBp: 0,
  taxAmountMinor: "0",
  netAmountMinor: "250000",
  grossAmountMinor: "250000",
  currency: "UAH",
  priceSource: "base" as const,
  personalPriceId: null,
  priceListId: null,
  priceListEntryId: null,
  resolverVersion: 1,
};

function order(overrides: Partial<GetOrderOutput> = {}): GetOrderOutput {
  return {
    orderId: ORDER_ID,
    customerId: CUSTOMER_ID,
    status: "new",
    comment: "Без горіхів",
    totalNetMinor: "250000",
    totalTaxMinor: "0",
    totalGrossMinor: "250000",
    currency: "UAH",
    confirmedAt: null,
    createdAt: "2026-08-25T12:00:00.000Z",
    items: [LINE],
    ...overrides,
  };
}

describe("formatQuantityMilli", () => {
  it("formats scale-3 milli as a decimal with trailing zeros omitted", () => {
    expect(formatQuantityMilli("1000")).toBe("1");
    expect(formatQuantityMilli("1500")).toBe("1,5");
    expect(formatQuantityMilli("1050")).toBe("1,05");
    expect(formatQuantityMilli("1001")).toBe("1,001");
    expect(formatQuantityMilli("500")).toBe("0,5");
  });

  it("rejects a non-canonical quantity wire value", () => {
    expect(() => formatQuantityMilli("0")).toThrow();
    expect(() => formatQuantityMilli("01")).toThrow();
    expect(() => formatQuantityMilli("1.5")).toThrow();
  });
});

describe("toOrderDetailView", () => {
  const copy = ordersCopy("uk");

  it("maps status pill, snapshot lines, comment, and due from totalGrossMinor", () => {
    const view = toOrderDetailView({
      order: order(),
      copy,
      customer: { kind: "ready", name: "Марія Ткаченко" },
      customerPhone: " +380501112233 ",
    });
    expect(view.status).toBe("new");
    expect(view.statusLabel).toBe("Новий");
    expect(view.statusTone).toBe("action");
    expect(view.comment).toBe("Без горіхів");
    expect(view.dueLabel).toBe("2\u00A0500\u00A0₴");
    expect(view.lines).toEqual([
      {
        itemId: ITEM_ID,
        title: "Торт «Київський»",
        metaLabel: "1\u00A0250\u00A0₴ \u00D7 2",
        grossLabel: "2\u00A0500\u00A0₴",
      },
    ]);
    expect(view.customerName).toBe("Марія Ткаченко");
    expect(view.customerNamePending).toBe(false);
    expect(view.customerPhone).toBe("+380501112233");
    expect(JSON.stringify(view)).not.toContain("SHZ-");
    expect(JSON.stringify(view)).not.toContain("basePriceMinor");
  });

  it("maps confirmed and canceled pills and hides empty comments", () => {
    const confirmed = toOrderDetailView({
      order: order({ status: "confirmed", comment: "   " }),
      copy,
      customer: { kind: "ready", name: "Марія Ткаченко" },
      customerPhone: null,
    });
    expect(confirmed.statusLabel).toBe("Підтверджено");
    expect(confirmed.statusTone).toBe("action");
    expect(confirmed.comment).toBeNull();
    expect(confirmed.customerPhone).toBeNull();

    const canceled = toOrderDetailView({
      order: order({ status: "canceled", comment: null }),
      copy,
      customer: { kind: "missing" },
      customerPhone: "",
    });
    expect(canceled.statusLabel).toBe("Скасовано");
    expect(canceled.statusTone).toBe("danger");
    expect(canceled.customerName).toBe(copy.missingCustomer);
    expect(canceled.comment).toBeNull();
  });

  it("keeps snapshot unit/gross even when they would not match a live unit × qty", () => {
    const view = toOrderDetailView({
      order: order({
        totalGrossMinor: "100",
        items: [
          {
            ...LINE,
            quantityMilli: "1000",
            unitPriceMinor: "999",
            netAmountMinor: "100",
            grossAmountMinor: "100",
          },
        ],
      }),
      copy,
      customer: { kind: "pending" },
      customerPhone: null,
    });
    expect(view.lines[0]?.metaLabel).toBe("9,99\u00A0₴ \u00D7 1");
    expect(view.lines[0]?.grossLabel).toBe("1\u00A0₴");
    expect(view.dueLabel).toBe("1\u00A0₴");
    expect(view.customerNamePending).toBe(true);
    expect(view.customerName).toBe("");
  });
});

describe("orderDetailHeaderTitle", () => {
  it("uses the customer name, not an order number", () => {
    expect(
      orderDetailHeaderTitle({
        customer: { kind: "ready", name: "Марія Ткаченко" },
        fallbackTitle: "Замовлення",
        missingCustomer: "Клієнт видалений",
      }),
    ).toBe("Марія Ткаченко");
    expect(
      orderDetailHeaderTitle({
        customer: { kind: "missing" },
        fallbackTitle: "Замовлення",
        missingCustomer: "Клієнт видалений",
      }),
    ).toBe("Клієнт видалений");
    expect(
      orderDetailHeaderTitle({
        customer: { kind: "pending" },
        fallbackTitle: "Замовлення",
        missingCustomer: "Клієнт видалений",
      }),
    ).toBe("Замовлення");
  });
});

describe("orderDetailActionsForView", () => {
  it("shows confirm only for new", () => {
    expect(
      orderDetailActionsForView({ canEdit: true, status: "new" }).showConfirm,
    ).toBe(true);
    expect(
      orderDetailActionsForView({ canEdit: true, status: "confirmed" })
        .showConfirm,
    ).toBe(false);
    expect(
      orderDetailActionsForView({ canEdit: true, status: "canceled" })
        .showConfirm,
    ).toBe(false);
  });

  it("disables cancel for canceled and hides both without edit", () => {
    expect(
      orderDetailActionsForView({ canEdit: true, status: "canceled" }),
    ).toEqual({
      showConfirm: false,
      showActions: true,
      cancelEnabled: false,
    });
    expect(
      orderDetailActionsForView({ canEdit: false, status: "new" }),
    ).toEqual({
      showConfirm: false,
      showActions: false,
      cancelEnabled: false,
    });
  });

  it("hides confirm and actions when a cached order is error or offline", () => {
    const actionFlags = orderDetailActionsForView({
      canEdit: true,
      status: "new",
    });
    expect(actionFlags).toEqual({
      showConfirm: true,
      showActions: true,
      cancelEnabled: true,
    });
    const cached = { hasOrder: true, actionFlags };
    expect(orderDetailWriteChrome({ stateKind: "error", ...cached })).toEqual({
      showConfirm: false,
      showActions: false,
      cancelEnabled: false,
    });
    expect(orderDetailWriteChrome({ stateKind: "offline", ...cached })).toEqual(
      {
        showConfirm: false,
        showActions: false,
        cancelEnabled: false,
      },
    );
    expect(orderDetailWriteChrome({ stateKind: "loading", ...cached })).toEqual(
      {
        showConfirm: false,
        showActions: false,
        cancelEnabled: false,
      },
    );
    expect(orderDetailWriteChrome({ stateKind: "ready", ...cached })).toEqual(
      actionFlags,
    );
    expect(
      orderDetailWriteChrome({
        stateKind: "ready",
        hasOrder: false,
        actionFlags,
      }),
    ).toEqual({
      showConfirm: false,
      showActions: false,
      cancelEnabled: false,
    });
  });
});

describe("orderDetailConfirmLoading", () => {
  it("does not paint Confirm as loading while cancel is in flight", () => {
    const chrome = orderDetailWriteChrome({
      stateKind: "ready",
      hasOrder: true,
      actionFlags: orderDetailActionsForView({
        canEdit: true,
        status: "new",
      }),
    });
    expect(chrome.showConfirm).toBe(true);
    expect(
      orderDetailConfirmLoading({
        confirmPending: false,
        cancelPending: true,
      }),
    ).toBe(false);
  });

  it("shows Confirm loading only when confirm is in flight", () => {
    expect(
      orderDetailConfirmLoading({
        confirmPending: true,
        cancelPending: false,
      }),
    ).toBe(true);
    expect(
      orderDetailConfirmLoading({
        confirmPending: false,
        cancelPending: false,
      }),
    ).toBe(false);
  });
});

describe("commentIfPresent", () => {
  it("treats blank comments as absent", () => {
    expect(commentIfPresent(null)).toBeNull();
    expect(commentIfPresent("  ")).toBeNull();
    expect(commentIfPresent("Нотатка")).toBe("Нотатка");
  });
});

describe("order write banners", () => {
  const copy = ordersCopy("uk").detail;

  it("maps offline, permission, and other failures", () => {
    expect(mapOrderWriteFailure(null)).toBeNull();
    expect(mapOrderWriteFailure("offline")).toBe("offline");
    expect(mapOrderWriteFailure("permission")).toBe("permission");
    expect(mapOrderWriteFailure("conflict")).toBe("error");
    expect(orderWriteBanner("offline", copy)).toBe(copy.mutationOffline);
    expect(orderWriteBanner("permission", copy)).toBe(copy.mutationPermission);
    expect(orderWriteBanner("error", copy)).toBe(copy.mutationError);
  });

  it("retries a failed write and submits a fresh one otherwise", () => {
    expect(planOrderStatusWrite(true)).toBe("retry");
    expect(planOrderStatusWrite(false)).toBe("submit");
  });
});
