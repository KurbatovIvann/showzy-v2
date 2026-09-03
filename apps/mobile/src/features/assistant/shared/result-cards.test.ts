import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { formatMoneyMinor } from "../../../format/money";
import { assistantCopy } from "../../../i18n/assistant";
import { ordersCopy } from "../../../i18n/orders";
import { orderDetailHref } from "../../orders/shared/order-hrefs";
import {
  ASSISTANT_ORDERS_LIST_HREF,
  ASSISTANT_ORDERS_LIST_ROW_MAX,
  assistantResultCardsFromParts,
  isOrderStatus,
  ORDER_STATUSES,
} from "./result-cards";

const ORDER_A = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";
const ORDER_B = "1a2b3c4d-5e6f-4789-8abc-def012345678";
const uk = assistantCopy("uk");
const ordersUk = ordersCopy("uk");

function pageRow(
  orderId: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    orderId,
    orderNumber: "1049",
    customer: { nameSnapshot: "Іван", linkedCustomerId: null },
    status: "new",
    itemCount: 2,
    totalGrossMinor: "33000",
    currency: "UAH",
    createdAt: "2026-09-03T10:00:00.000Z",
    ...overrides,
  };
}

function pageOutput(
  items: unknown[],
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    kind: "page.summary",
    items,
    nextCursor: null,
    customerMatchTruncated: false,
    ...extra,
  };
}

function countsOutput(
  buckets: unknown[],
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    kind: "aggregate",
    orderCount: 6,
    grossByCurrency: [{ currency: "UAH", grossAmountMinor: "1000" }],
    buckets,
    bucketsTruncated: false,
    customerMatchTruncated: false,
    ...extra,
  };
}

describe("assistantResultCardsFromParts", () => {
  it("accepts the five CHECK statuses and rejects active/completed aliases", () => {
    expect(ORDER_STATUSES).toEqual([
      "new",
      "confirmed",
      "in_progress",
      "done",
      "canceled",
    ]);
    expect(isOrderStatus("new")).toBe(true);
    expect(isOrderStatus("confirmed")).toBe(true);
    expect(isOrderStatus("in_progress")).toBe(true);
    expect(isOrderStatus("done")).toBe(true);
    expect(isOrderStatus("canceled")).toBe(true);
    expect(isOrderStatus("active")).toBe(false);
    expect(isOrderStatus("completed")).toBe(false);
    expect(isOrderStatus("all")).toBe(false);
  });

  it("caps the list card at 9 rows", () => {
    const items = Array.from({ length: 12 }, (_, index) =>
      pageRow(
        `0f0e2d5c-4a1b-4c3d-9e8f-1029384756${String(index).padStart(2, "0")}`,
        { orderNumber: String(1000 + index) },
      ),
    );
    const cards = assistantResultCardsFromParts(
      [
        {
          type: "tool-orders_list_page",
          toolCallId: "call-page",
          state: "output-available",
          output: pageOutput(items),
        },
      ],
      "uk",
    );
    expect(ASSISTANT_ORDERS_LIST_ROW_MAX).toBe(9);
    expect(cards.listCard?.rows).toHaveLength(9);
    expect(cards.entityCards).toHaveLength(0);
  });

  it("adds status chips when counts are on the same turn", () => {
    const cards = assistantResultCardsFromParts(
      [
        {
          type: "tool-orders_list_counts",
          toolCallId: "call-counts",
          state: "output-available",
          output: countsOutput([
            {
              identity: { kind: "status", status: "confirmed" },
              label: "confirmed",
              orderCount: 4,
              grossByCurrency: [],
            },
            {
              identity: { kind: "status", status: "new" },
              label: "new",
              orderCount: 2,
              grossByCurrency: [],
            },
          ]),
        },
        {
          type: "tool-orders_list_page",
          toolCallId: "call-page",
          state: "output-available",
          output: pageOutput([pageRow(ORDER_A)]),
        },
      ],
      "uk",
    );
    expect(cards.listCard?.chips.map((chip) => chip.status)).toEqual([
      "new",
      "confirmed",
    ]);
    expect(cards.listCard?.chips[0]?.label).toBe(
      `${ordersUk.statuses.new} · 2`,
    );
    expect(cards.listCard?.chips[1]?.label).toBe(
      `${ordersUk.statuses.confirmed} · 4`,
    );
    expect(cards.listCard?.kind).toBe("orders-list");
    expect(cards.entityCards).toHaveLength(0);
  });

  it("renders an empty page without inventing rows", () => {
    const cards = assistantResultCardsFromParts(
      [
        {
          type: "tool-orders_list_page",
          toolCallId: "call-page",
          state: "output-available",
          output: pageOutput([]),
        },
      ],
      "uk",
    );
    expect(cards.listCard?.rows).toEqual([]);
    expect(cards.listCard?.emptyTitle).toBe(uk.cards.listEmptyTitle);
    expect(cards.listCard?.emptyDescription).toBe(
      uk.cards.listEmptyDescription,
    );
    expect(cards.listCard?.ctaHref).toBeNull();
  });

  it("sends nextCursor to /orders instead of in-chat paging", () => {
    const cards = assistantResultCardsFromParts(
      [
        {
          type: "tool-orders_list_page",
          toolCallId: "call-page",
          state: "output-available",
          output: pageOutput([pageRow(ORDER_A)], { nextCursor: "cursor-2" }),
        },
      ],
      "uk",
    );
    expect(cards.listCard?.ctaHref).toBe(ASSISTANT_ORDERS_LIST_HREF);
    expect(cards.listCard?.ctaHref).toBe("/orders");
    expect(cards.listCard?.ctaLabel).toBe(uk.cards.openOrders);
    expect(cards.listCard !== null && "nextCursor" in cards.listCard).toBe(
      false,
    );
    expect(cards.listCard !== null && "loadMore" in cards.listCard).toBe(false);
    expect(cards.listCard !== null && "cursor" in cards.listCard).toBe(false);
  });

  it("sends a clipped envelope to /orders", () => {
    const cards = assistantResultCardsFromParts(
      [
        {
          type: "tool-orders_list_page",
          toolCallId: "call-page",
          state: "output-available",
          output: {
            status: "clipped",
            omitted: 12,
            preview: pageOutput([pageRow(ORDER_A)], { nextCursor: null }),
          },
        },
      ],
      "uk",
    );
    expect(cards.listCard?.ctaHref).toBe("/orders");
    expect(cards.listCard?.footnotes).toContain(uk.cards.clipped);
    expect(cards.listCard?.rows).toHaveLength(1);
  });

  it("shows customerMatchTruncated as a footnote, not paging", () => {
    const cards = assistantResultCardsFromParts(
      [
        {
          type: "tool-orders_list_page",
          toolCallId: "call-page",
          state: "output-available",
          output: pageOutput([pageRow(ORDER_A)], {
            customerMatchTruncated: true,
          }),
        },
      ],
      "uk",
    );
    expect(cards.listCard?.footnotes).toEqual([
      uk.cards.customerMatchTruncated,
    ]);
    expect(cards.listCard?.ctaHref).toBeNull();
    expect(cards.listCard !== null && "nextCursor" in cards.listCard).toBe(
      false,
    );
  });

  it("never paints an active chip, including from counts buckets", () => {
    const cards = assistantResultCardsFromParts(
      [
        {
          type: "tool-orders_list_counts",
          toolCallId: "call-counts",
          state: "output-available",
          output: countsOutput([
            {
              identity: { kind: "status", status: "active" },
              label: "active",
              orderCount: 6,
              grossByCurrency: [],
            },
            {
              identity: { kind: "none" },
              label: "All",
              orderCount: 6,
              grossByCurrency: [],
            },
            {
              identity: { kind: "status", status: "new" },
              label: "new",
              orderCount: 3,
              grossByCurrency: [],
            },
            {
              identity: { kind: "status", status: "confirmed" },
              label: "confirmed",
              orderCount: 3,
              grossByCurrency: [],
            },
          ]),
        },
        {
          type: "tool-orders_list_page",
          toolCallId: "call-page",
          state: "output-available",
          output: pageOutput([
            pageRow(ORDER_A, { status: "new" }),
            pageRow(ORDER_B, { status: "confirmed", orderNumber: "1050" }),
          ]),
        },
      ],
      "uk",
    );
    const chipJson = JSON.stringify(cards.listCard?.chips);
    expect(chipJson.includes("active")).toBe(false);
    expect(cards.listCard?.chips.map((chip) => chip.status)).toEqual([
      "new",
      "confirmed",
    ]);
    expect(cards.listCard?.chips.map((chip) => chip.status)).not.toContain(
      "active",
    );
  });

  it("paints in_progress and done chips from CHECK status buckets", () => {
    const cardsUk = assistantResultCardsFromParts(
      [
        {
          type: "tool-orders_list_counts",
          toolCallId: "call-counts",
          state: "output-available",
          output: countsOutput([
            {
              identity: { kind: "status", status: "active" },
              label: "active",
              orderCount: 9,
              grossByCurrency: [],
            },
            {
              identity: { kind: "status", status: "done" },
              label: "done",
              orderCount: 1,
              grossByCurrency: [],
            },
            {
              identity: { kind: "status", status: "in_progress" },
              label: "in_progress",
              orderCount: 2,
              grossByCurrency: [],
            },
            {
              identity: { kind: "status", status: "canceled" },
              label: "canceled",
              orderCount: 1,
              grossByCurrency: [],
            },
          ]),
        },
        {
          type: "tool-orders_list_page",
          toolCallId: "call-page",
          state: "output-available",
          output: pageOutput([
            pageRow(ORDER_A, { status: "in_progress" }),
            pageRow(ORDER_B, { status: "done", orderNumber: "1050" }),
          ]),
        },
      ],
      "uk",
    );
    expect(cardsUk.listCard?.chips.map((chip) => chip.status)).toEqual([
      "in_progress",
      "done",
      "canceled",
    ]);
    expect(cardsUk.listCard?.chips[0]?.label).toBe(
      `${ordersUk.statuses.in_progress} · 2`,
    );
    expect(cardsUk.listCard?.chips[1]?.label).toBe(
      `${ordersUk.statuses.done} · 1`,
    );
    expect(cardsUk.listCard?.chips[0]?.tone).toBe("attention");
    expect(cardsUk.listCard?.chips[1]?.tone).toBe("success");
    expect(cardsUk.listCard?.rows[0]?.statusLabel).toBe(
      ordersUk.statuses.in_progress,
    );
    expect(cardsUk.listCard?.rows[1]?.statusLabel).toBe(ordersUk.statuses.done);
    expect(JSON.stringify(cardsUk.listCard?.chips).includes("active")).toBe(
      false,
    );

    const cardsEn = assistantResultCardsFromParts(
      [
        {
          type: "tool-orders_list_counts",
          toolCallId: "call-counts",
          state: "output-available",
          output: countsOutput([
            {
              identity: { kind: "status", status: "in_progress" },
              label: "in_progress",
              orderCount: 2,
              grossByCurrency: [],
            },
          ]),
        },
        {
          type: "tool-orders_list_page",
          toolCallId: "call-page",
          state: "output-available",
          output: pageOutput([pageRow(ORDER_A, { status: "in_progress" })]),
        },
      ],
      "en",
    );
    expect(cardsEn.listCard?.chips[0]?.label).toBe("In progress · 2");
    expect(cardsEn.listCard?.rows[0]?.statusLabel).toBe("In progress");
  });

  it("does not render a list or aggregate card on counts-only turns", () => {
    const cards = assistantResultCardsFromParts(
      [
        {
          type: "tool-orders_list_counts",
          toolCallId: "call-counts",
          state: "output-available",
          output: countsOutput([
            {
              identity: { kind: "status", status: "new" },
              label: "new",
              orderCount: 2,
              grossByCurrency: [],
            },
          ]),
        },
      ],
      "uk",
    );
    expect(cards.listCard).toBeNull();
    expect(cards.entityCards).toEqual([]);
  });

  it("does not turn list items into N orders.get entity cards", () => {
    const cards = assistantResultCardsFromParts(
      [
        {
          type: "tool-orders_list_page",
          toolCallId: "call-page",
          state: "output-available",
          output: pageOutput([pageRow(ORDER_A), pageRow(ORDER_B)]),
        },
      ],
      "uk",
    );
    expect(cards.listCard?.rows).toHaveLength(2);
    expect(cards.entityCards).toEqual([]);
  });

  it("maps compact list rows onto orderDetailHref", () => {
    const cards = assistantResultCardsFromParts(
      [
        {
          type: "tool-orders_list_page",
          toolCallId: "call-page",
          state: "output-available",
          output: pageOutput([pageRow(ORDER_A)]),
        },
      ],
      "uk",
    );
    const row = cards.listCard?.rows[0];
    expect(row?.href).toBe(orderDetailHref(ORDER_A));
    expect(row?.orderNumberLabel).toBe("#1049");
    expect(row?.customerName).toBe("Іван");
    expect(row?.statusLabel).toBe(ordersUk.statuses.new);
    expect(row?.totalLabel).toBe(formatMoneyMinor("33000", "UAH"));
    expect(row?.metaLabel.includes("1049")).toBe(true);
  });

  it("introduces a thin entity card from live orders.get / orders.create", () => {
    const cards = assistantResultCardsFromParts(
      [
        {
          type: "tool-orders_get",
          toolCallId: "call-get",
          state: "output-available",
          output: {
            orderId: ORDER_A,
            orderNumber: "1049",
            customerId: ORDER_B,
            status: "confirmed",
            totalGrossMinor: "33000",
            currency: "UAH",
            createdAt: "2026-09-03T10:00:00.000Z",
            items: [
              { itemId: ORDER_B, titleSnapshot: "Rose" },
              { itemId: ORDER_A, titleSnapshot: "Tulip" },
            ],
          },
        },
        {
          type: "tool-orders_create",
          toolCallId: "call-create",
          state: "output-available",
          output: {
            orderId: ORDER_B,
            orderNumber: "1050",
            customer: { nameSnapshot: "Оля", linkedCustomerId: null },
            status: "new",
            itemCount: 1,
            totalGrossMinor: "1000",
            currency: "UAH",
            createdAt: "2026-09-03T11:00:00.000Z",
          },
        },
      ],
      "uk",
    );
    expect(cards.listCard).toBeNull();
    expect(cards.entityCards).toHaveLength(2);
    expect(cards.entityCards[0]?.orderId).toBe(ORDER_A);
    expect(cards.entityCards[0]?.href).toBe(orderDetailHref(ORDER_A));
    expect(cards.entityCards[0]?.customerName).toBeNull();
    expect(cards.entityCards[1]?.customerName).toBe("Оля");
    expect(cards.entityCards).toHaveLength(2);
  });

  it("parses in_progress and done on the thin entity card", () => {
    const cards = assistantResultCardsFromParts(
      [
        {
          type: "tool-orders_get",
          toolCallId: "call-get-progress",
          state: "output-available",
          output: {
            orderId: ORDER_A,
            orderNumber: "1049",
            status: "in_progress",
            totalGrossMinor: "33000",
            currency: "UAH",
          },
        },
        {
          type: "tool-orders_get",
          toolCallId: "call-get-done",
          state: "output-available",
          output: {
            orderId: ORDER_B,
            orderNumber: "1050",
            status: "done",
            totalGrossMinor: "1000",
            currency: "UAH",
          },
        },
      ],
      "uk",
    );
    expect(cards.listCard).toBeNull();
    expect(cards.entityCards[0]?.statusLabel).toBe(
      ordersUk.statuses.in_progress,
    );
    expect(cards.entityCards[0]?.statusTone).toBe("attention");
    expect(cards.entityCards[1]?.statusLabel).toBe(ordersUk.statuses.done);
    expect(cards.entityCards[1]?.statusTone).toBe("success");
  });
});

describe("assistant result card composition", () => {
  it("composes Card / StatusPill and does not embed OrdersListScreen / OrderRow", () => {
    const listCard = readFileSync(
      new URL("../sheet/orders-list-result-card.tsx", import.meta.url),
      "utf8",
    );
    const entityCard = readFileSync(
      new URL("../sheet/order-entity-card.tsx", import.meta.url),
      "utf8",
    );
    const mapper = readFileSync(
      new URL("./result-cards.ts", import.meta.url),
      "utf8",
    );
    const messageRow = readFileSync(
      new URL("../sheet/assistant-message-row.tsx", import.meta.url),
      "utf8",
    );
    const hook = readFileSync(
      new URL("../sheet/use-assistant-sheet.ts", import.meta.url),
      "utf8",
    );
    expect(listCard).toContain("Card");
    expect(listCard).toContain("StatusPill");
    expect(listCard).toContain('from "../../../components/ui"');
    expect(listCard.includes("orders-list-screen")).toBe(false);
    expect(listCard.includes("order-row")).toBe(false);
    expect(listCard.includes('from "../../orders/list')).toBe(false);
    expect(entityCard).toContain("Card");
    expect(entityCard).toContain("StatusPill");
    expect(entityCard.includes("orders-list-screen")).toBe(false);
    expect(entityCard.includes("order-row")).toBe(false);
    expect(messageRow.includes("orders-list-screen")).toBe(false);
    expect(messageRow.includes("order-row")).toBe(false);
    expect(hook).toContain("orderDetailHref");
    expect(hook).toContain("ASSISTANT_ORDERS_LIST_HREF");
    expect(hook.includes("orders-list-screen")).toBe(false);
    expect(hook.includes("order-row")).toBe(false);
    expect(mapper.includes('from "@showzy/ai"')).toBe(false);
    expect(mapper.includes('from "@showzy/core"')).toBe(false);
    expect(mapper).not.toContain("extractUuidResultIds");
    expect(mapper).not.toContain("sit.svg");
    expect(mapper).not.toContain("dig.svg");
    expect(listCard).not.toContain("sit.svg");
    expect(listCard).not.toContain("listen.svg");
  });
});
