import { describe, expect, it } from "vitest";

import { ordersCopy } from "../../../i18n/orders";
import type { GetOrderOutput } from "../api/get";
import { orderDetailActions } from "../shared/order-permissions";
import {
  commentIfPresent,
  formatOrderNumber,
  mapOrderWriteFailure,
  orderDetailWriteChrome,
  orderWriteBanner,
  planOrderStatusWrite,
  toOrderDetailView,
} from "./order-detail.presenter";

const ORDER: GetOrderOutput = {
  orderId: "11111111-1111-4111-8111-111111111111",
  orderNumber: "KL-K7K3K4",
  customerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  status: "new",
  comment: "  Packed separately  ",
  totalNetMinor: "150000",
  totalTaxMinor: "0",
  totalGrossMinor: "150000",
  currency: "UAH",
  confirmedAt: null,
  createdAt: "2026-03-15T12:00:00.000Z",
  items: [
    {
      itemId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      productId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      variantId: null,
      titleSnapshot: "Троянди",
      quantityMilli: "3000",
      unitPriceMinor: "50000",
      discountKind: "none",
      discountValue: "0",
      discountAmountMinor: "0",
      taxTreatment: "exempt",
      taxRateBp: 0,
      taxAmountMinor: "0",
      netAmountMinor: "150000",
      grossAmountMinor: "150000",
      currency: "UAH",
      priceSource: "base",
      personalPriceId: null,
      priceListId: null,
      priceListEntryId: null,
      resolverVersion: 1,
    },
  ],
};

describe("order detail presenter (SHO-378)", () => {
  it("formats #PREFIX-TOKEN, snapshot lines, and comment without repricing", () => {
    const copy = ordersCopy("uk");
    const view = toOrderDetailView({
      order: ORDER,
      copy,
      customer: { kind: "ready", name: "Анна Мельник" },
      customerPhone: "  +380671112233  ",
    });
    expect(formatOrderNumber(view.orderNumber)).toBe("#KL-K7K3K4");
    expect(view.customerName).toBe("Анна Мельник");
    expect(view.status).toBe("new");
    expect(view.statusLabel).toBe("Нове");
    expect(view.statusTone).toBe("action");
    expect(view.comment).toBe("Packed separately");
    expect(view.lines).toHaveLength(1);
    expect(view.lines[0]?.title).toBe("Троянди");
    expect(view.lines[0]?.metaLabel).toContain("\u00D7");
    expect(view.lines[0]?.metaLabel).toContain("3");
    expect(view.showPhoneIcon).toBe(true);
    expect(view.customerPhone).toBe("+380671112233");
    expect(view.dueLabel).toContain("₴");
  });

  it("drops blank comments and phones", () => {
    expect(commentIfPresent("   ")).toBeNull();
    expect(commentIfPresent(null)).toBeNull();
    const copy = ordersCopy("uk");
    const view = toOrderDetailView({
      order: { ...ORDER, comment: "   " },
      copy,
      customer: { kind: "missing" },
      customerPhone: "  ",
    });
    expect(view.comment).toBeNull();
    expect(view.showPhoneIcon).toBe(false);
    expect(view.customerName).toBe("Клієнт видалений");
  });

  it("hides write chrome until the get is ready", () => {
    const flags = orderDetailActions({ canEdit: true, status: "new" });
    expect(
      orderDetailWriteChrome({
        stateKind: "loading",
        hasOrder: false,
        actionFlags: flags,
      }).showConfirm,
    ).toBe(false);
    expect(
      orderDetailWriteChrome({
        stateKind: "ready",
        hasOrder: true,
        actionFlags: flags,
      }).showConfirm,
    ).toBe(true);
  });

  it("maps write failures by kind, never message text", () => {
    const copy = ordersCopy("uk").detail;
    expect(mapOrderWriteFailure("permission")).toBe("permission");
    expect(mapOrderWriteFailure("network")).toBe("offline");
    expect(mapOrderWriteFailure("offline")).toBe("offline");
    expect(mapOrderWriteFailure("conflict")).toBe("error");
    expect(mapOrderWriteFailure("confirmation")).toBeNull();
    expect(orderWriteBanner("permission", copy)).toBe(copy.mutationPermission);
    expect(orderWriteBanner("offline", copy)).toBe(copy.mutationOffline);
    expect(orderWriteBanner("error", copy)).toBe(copy.mutationError);
    expect(planOrderStatusWrite(true)).toBe("retry");
    expect(planOrderStatusWrite(false)).toBe("submit");
  });
});
