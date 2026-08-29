import { describe, expect, it } from "vitest";

import { ordersCopy } from "../../../i18n/orders";
import type { OrderListItem } from "../api/order.queries";
import {
  classifyOrdersList,
  customerNameLabel,
  filterOrdersBySelectedStatuses,
  flattenOrderPages,
  formatOrderCreatedAt,
  groupOrderRows,
  hasActiveStatusFilter,
  isInProgressStatus,
  listOrdersPageInput,
  listOrdersStatusParam,
  orderGroupHeaderLabel,
  orderStatusTone,
  resolveCustomerNameHydration,
  shouldPageThroughClientStatusFilter,
  stickyHeaderIndices,
  toggleOrderStatusFilter,
  toOrderRowView,
  type OrderRowView,
} from "./orders-list.presenter";

const CUSTOMER_A = "11111111-1111-4111-8111-111111111111";
const CUSTOMER_B = "22222222-2222-4222-8222-222222222222";
const ORDER_NEW = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";
const ORDER_CONFIRMED = "1f0e2d5c-4a1b-4c3d-9e8f-102938475602";
const ORDER_CANCELED = "2f0e2d5c-4a1b-4c3d-9e8f-102938475603";

function item(overrides: Partial<OrderListItem> = {}): OrderListItem {
  return {
    orderId: ORDER_NEW,
    orderNumber: 1,
    customerId: CUSTOMER_A,
    status: "new",
    itemCount: 2,
    totalGrossMinor: "125000",
    currency: "UAH",
    createdAt: "2026-08-25T12:00:00.000Z",
    ...overrides,
  };
}

function row(overrides: Partial<OrderRowView> = {}): OrderRowView {
  return {
    id: ORDER_NEW,
    customerName: "Марія Ткаченко",
    customerNamePending: false,
    status: "new",
    statusLabel: "Новий",
    statusTone: "action",
    metaLabel: "2 позиції · 25 серп. 2026",
    totalLabel: "1 250 ₴",
    ...overrides,
  };
}

describe("toggleOrderStatusFilter", () => {
  it("adds, removes, and keeps canonical order", () => {
    expect(toggleOrderStatusFilter([], "confirmed")).toEqual(["confirmed"]);
    expect(toggleOrderStatusFilter(["confirmed"], "new")).toEqual([
      "new",
      "confirmed",
    ]);
    expect(
      toggleOrderStatusFilter(["new", "confirmed", "canceled"], "confirmed"),
    ).toEqual(["new", "canceled"]);
  });
});

describe("listOrdersStatusParam / listOrdersPageInput", () => {
  it("maps empty selected statuses to all", () => {
    expect(listOrdersStatusParam([])).toBe("all");
    expect(listOrdersPageInput([])).toEqual({ status: "all" });
    expect(hasActiveStatusFilter([])).toBe(false);
  });

  it("sends a single selected status to the server", () => {
    expect(listOrdersStatusParam(["canceled"])).toBe("canceled");
    expect(listOrdersPageInput(["new"])).toEqual({ status: "new" });
    expect(hasActiveStatusFilter(["new"])).toBe(true);
  });

  it("fetches all when two or three statuses are selected", () => {
    expect(listOrdersStatusParam(["new", "canceled"])).toBe("all");
    expect(listOrdersStatusParam(["new", "confirmed", "canceled"])).toBe("all");
  });
});

describe("filterOrdersBySelectedStatuses", () => {
  it("keeps every row when the selection is empty", () => {
    const items = [
      item({ orderId: ORDER_NEW, status: "new" }),
      item({ orderId: ORDER_CANCELED, status: "canceled" }),
    ];
    expect(filterOrdersBySelectedStatuses(items, [])).toEqual(items);
  });

  it("keeps only the selected statuses for a multi-select page", () => {
    const items = [
      item({ orderId: ORDER_NEW, status: "new" }),
      item({ orderId: ORDER_CONFIRMED, status: "confirmed" }),
      item({ orderId: ORDER_CANCELED, status: "canceled" }),
    ];
    expect(
      filterOrdersBySelectedStatuses(items, ["new", "canceled"]).map(
        (entry) => entry.orderId,
      ),
    ).toEqual([ORDER_NEW, ORDER_CANCELED]);
  });
});

describe("flattenOrderPages", () => {
  it("concatenates page items in order", () => {
    const first = item({ orderId: ORDER_NEW });
    const second = item({ orderId: ORDER_CONFIRMED });
    const third = item({ orderId: ORDER_CANCELED });
    expect(
      flattenOrderPages([{ items: [first, second] }, { items: [third] }]),
    ).toEqual([first, second, third]);
  });
});

describe("resolveCustomerNameHydration / customerNameLabel", () => {
  const fallback = "Клієнт видалений";

  it("uses a ready name and treats null CRM as missing copy", () => {
    expect(
      customerNameLabel({ kind: "ready", name: "Марія Ткаченко" }, fallback),
    ).toBe("Марія Ткаченко");
    expect(customerNameLabel({ kind: "missing" }, fallback)).toBe(fallback);
    expect(
      resolveCustomerNameHydration({
        customerId: null,
        name: undefined,
        status: "pending",
        notFound: false,
      }),
    ).toEqual({ kind: "missing" });
  });

  it("keeps pending and non-NOT_FOUND failures off the deleted copy", () => {
    expect(customerNameLabel({ kind: "pending" }, fallback)).toBe("");
    expect(
      resolveCustomerNameHydration({
        customerId: CUSTOMER_A,
        name: undefined,
        status: "pending",
        notFound: false,
      }),
    ).toEqual({ kind: "pending" });
    expect(
      resolveCustomerNameHydration({
        customerId: CUSTOMER_A,
        name: undefined,
        status: "error",
        notFound: false,
      }),
    ).toEqual({ kind: "pending" });
    expect(
      resolveCustomerNameHydration({
        customerId: CUSTOMER_A,
        name: undefined,
        status: "error",
        notFound: true,
      }),
    ).toEqual({ kind: "missing" });
    expect(
      resolveCustomerNameHydration({
        customerId: CUSTOMER_A,
        name: "   ",
        status: "success",
        notFound: false,
      }),
    ).toEqual({ kind: "missing" });
    expect(
      resolveCustomerNameHydration({
        customerId: CUSTOMER_A,
        name: "  Марія  ",
        status: "pending",
        notFound: false,
      }),
    ).toEqual({ kind: "ready", name: "Марія" });
  });
});

describe("toOrderRowView", () => {
  it("maps a contract row onto primitives without order number or payment", () => {
    const copy = ordersCopy("uk");
    const view = toOrderRowView(
      item({
        customerId: CUSTOMER_B,
        status: "canceled",
        itemCount: 1,
        totalGrossMinor: "89000",
      }),
      { locale: "uk", copy, customerName: { kind: "missing" } },
    );
    expect(view.customerName).toBe(copy.missingCustomer);
    expect(view.customerNamePending).toBe(false);
    expect(view.status).toBe("canceled");
    expect(view.statusLabel).toBe("Скасовано");
    expect(view.statusTone).toBe("danger");
    expect(view.metaLabel).toContain("1 позиція");
    expect(view.metaLabel).toContain("25 серп. 2026");
    expect(view.totalLabel).toBe("890\u00A0₴");
    expect(JSON.stringify(view)).not.toContain("SHZ-");
    expect(JSON.stringify(view)).not.toContain("Оплачен");
  });

  it("keeps a hydrated customer name", () => {
    const view = toOrderRowView(item(), {
      locale: "uk",
      copy: ordersCopy("uk"),
      customerName: { kind: "ready", name: "Марія Ткаченко" },
    });
    expect(view.customerName).toBe("Марія Ткаченко");
    expect(view.customerNamePending).toBe(false);
    expect(view.statusTone).toBe("action");
  });

  it("does not print deleted copy while the name query is pending", () => {
    const copy = ordersCopy("uk");
    const view = toOrderRowView(item(), {
      locale: "uk",
      copy,
      customerName: { kind: "pending" },
    });
    expect(view.customerName).toBe("");
    expect(view.customerNamePending).toBe(true);
    expect(view.customerName).not.toBe(copy.missingCustomer);
  });
});

describe("formatOrderCreatedAt", () => {
  it("formats the canvas d MMM yyyy date in uk and en", () => {
    expect(formatOrderCreatedAt("2026-08-25T12:00:00.000Z", "uk")).toBe(
      "25 серп. 2026",
    );
    expect(formatOrderCreatedAt("2026-08-25T12:00:00.000Z", "en")).toBe(
      "25 Aug 2026",
    );
  });
});

describe("orderStatusTone / isInProgressStatus", () => {
  it("treats new and confirmed as in-progress action pills", () => {
    expect(isInProgressStatus("new")).toBe(true);
    expect(isInProgressStatus("confirmed")).toBe(true);
    expect(isInProgressStatus("canceled")).toBe(false);
    expect(orderStatusTone("new")).toBe("action");
    expect(orderStatusTone("confirmed")).toBe("action");
    expect(orderStatusTone("canceled")).toBe("danger");
  });
});

describe("groupOrderRows", () => {
  it("groups new+confirmed as in progress and canceled as completed", () => {
    const entries = groupOrderRows([
      row({ id: ORDER_NEW, status: "new" }),
      row({
        id: ORDER_CANCELED,
        status: "canceled",
        statusTone: "danger",
      }),
      row({ id: ORDER_CONFIRMED, status: "confirmed" }),
    ]);
    expect(entries.map((entry) => entry.type)).toEqual([
      "header",
      "row",
      "row",
      "header",
      "row",
    ]);
    expect(entries[0]).toEqual({
      type: "header",
      key: "inProgress",
      count: 2,
    });
    expect(entries[1]?.type === "row" ? entries[1].order.id : null).toBe(
      ORDER_NEW,
    );
    expect(entries[2]?.type === "row" ? entries[2].order.id : null).toBe(
      ORDER_CONFIRMED,
    );
    expect(entries[3]).toEqual({
      type: "header",
      key: "completed",
      count: 1,
    });
    expect(stickyHeaderIndices(entries)).toEqual([0, 3]);
  });

  it("omits an empty group", () => {
    expect(
      groupOrderRows([row({ id: ORDER_CANCELED, status: "canceled" })]),
    ).toEqual([
      { type: "header", key: "completed", count: 1 },
      {
        type: "row",
        order: row({ id: ORDER_CANCELED, status: "canceled" }),
      },
    ]);
  });
});

describe("orderGroupHeaderLabel", () => {
  it("interpolates the canvas group title and count", () => {
    expect(orderGroupHeaderLabel("inProgress", 3, ordersCopy("uk"))).toBe(
      "В роботі · 3",
    );
    expect(orderGroupHeaderLabel("completed", 1, ordersCopy("en"))).toBe(
      "Completed · 1",
    );
  });
});

describe("classifyOrdersList", () => {
  const base = {
    clientReady: true,
    status: "success" as const,
    failureKind: null,
    rowCount: 0,
    hasStatusFilter: false,
    hasNextPage: false,
    isFetchingNextPage: false,
  };

  it("is an error when the client is not ready", () => {
    expect(classifyOrdersList({ ...base, clientReady: false })).toEqual({
      kind: "error",
    });
  });

  it("is loading while the list query is pending", () => {
    expect(classifyOrdersList({ ...base, status: "pending" })).toEqual({
      kind: "loading",
    });
  });

  it("splits offline from other failures", () => {
    expect(
      classifyOrdersList({
        ...base,
        status: "error",
        failureKind: "offline",
      }),
    ).toEqual({ kind: "offline" });
    expect(
      classifyOrdersList({
        ...base,
        status: "error",
        failureKind: "network",
      }),
    ).toEqual({ kind: "error" });
  });

  it("shows rows whenever any are loaded", () => {
    expect(classifyOrdersList({ ...base, rowCount: 2 })).toEqual({
      kind: "rows",
    });
  });

  it("tells catalog-empty apart from filtered-empty", () => {
    expect(classifyOrdersList(base)).toEqual({ kind: "empty-catalog" });
    expect(classifyOrdersList({ ...base, hasStatusFilter: true })).toEqual({
      kind: "empty-filtered",
    });
    expect(
      classifyOrdersList({ ...base, rowCount: 1, hasStatusFilter: true }),
    ).toEqual({ kind: "rows" });
  });

  it("keeps list chrome when a filter has no matches yet but more pages exist", () => {
    expect(
      classifyOrdersList({
        ...base,
        hasStatusFilter: true,
        hasNextPage: true,
      }),
    ).toEqual({ kind: "rows" });
    expect(
      classifyOrdersList({
        ...base,
        hasStatusFilter: true,
        isFetchingNextPage: true,
      }),
    ).toEqual({ kind: "rows" });
  });
});

describe("shouldPageThroughClientStatusFilter", () => {
  const base = {
    selectedCount: 2,
    matchingRowCount: 0,
    status: "success" as const,
    hasNextPage: true,
    isFetchingNextPage: false,
  };

  it("pages a multi-select client filter while loaded pages have no matches", () => {
    expect(shouldPageThroughClientStatusFilter(base)).toBe(true);
    expect(
      shouldPageThroughClientStatusFilter({ ...base, selectedCount: 3 }),
    ).toBe(true);
  });

  it("does not page when a single status is server-filtered or none are selected", () => {
    expect(
      shouldPageThroughClientStatusFilter({ ...base, selectedCount: 1 }),
    ).toBe(false);
    expect(
      shouldPageThroughClientStatusFilter({ ...base, selectedCount: 0 }),
    ).toBe(false);
  });

  it("stops when matches exist, the cursor ends, or a page is already in flight", () => {
    expect(
      shouldPageThroughClientStatusFilter({ ...base, matchingRowCount: 1 }),
    ).toBe(false);
    expect(
      shouldPageThroughClientStatusFilter({ ...base, hasNextPage: false }),
    ).toBe(false);
    expect(
      shouldPageThroughClientStatusFilter({
        ...base,
        isFetchingNextPage: true,
      }),
    ).toBe(false);
    expect(
      shouldPageThroughClientStatusFilter({ ...base, status: "pending" }),
    ).toBe(false);
    expect(
      shouldPageThroughClientStatusFilter({ ...base, status: "error" }),
    ).toBe(false);
  });
});
