import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { formatMoneyMinor } from "../../../format/money";
import { assistantCopy } from "../../../i18n/assistant";
import { ordersCopy } from "../../../i18n/orders";
import { itemCountLabel } from "../../orders/shared/item-count";
import { formatOrderCreatedAt } from "../../orders/shared/order-created-at";
import { orderDetailHref } from "../../orders/shared/order-hrefs";
import { isToolErrorOutput } from "./confirmation-presenter";
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
    expect(cards.aggregateCard).toBeNull();
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

  it("renders one aggregate card on counts-only turns", () => {
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
    expect(cards.aggregateCard?.kind).toBe("orders-aggregate");
    expect(cards.entityCards).toEqual([]);
  });

  it("does not render a list card from a façade error orders_list_page", () => {
    const output = {
      status: "error" as const,
      code: "PERMISSION_DENIED",
      message: "Staff cannot list these orders",
    };
    expect(isToolErrorOutput(output)).toBe(true);
    const cards = assistantResultCardsFromParts(
      [
        {
          type: "tool-orders_list_page",
          toolCallId: "call-page",
          state: "output-available",
          output,
        },
      ],
      "uk",
    );
    expect(cards.listCard).toBeNull();
    expect(cards.aggregateCard).toBeNull();
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

  it("formats createdAt with the same locale helper as /orders", () => {
    const createdAt = "2026-08-25T12:00:00.000Z";
    const ukDate = formatOrderCreatedAt(createdAt, "uk");
    const enDate = formatOrderCreatedAt(createdAt, "en");
    expect(ukDate).toBe("25 серп. 2026");
    expect(enDate).toBe("25 Aug 2026");
    expect(ukDate).not.toBe(enDate);

    const parts = [
      {
        type: "tool-orders_list_page" as const,
        toolCallId: "call-page",
        state: "output-available" as const,
        output: pageOutput([pageRow(ORDER_A, { createdAt })]),
      },
    ];
    const ukRow = assistantResultCardsFromParts(parts, "uk").listCard?.rows[0];
    const enRow = assistantResultCardsFromParts(parts, "en").listCard?.rows[0];
    expect(ukRow?.metaLabel).toContain(ukDate);
    expect(enRow?.metaLabel).toContain(enDate);
    expect(ukRow?.metaLabel).not.toContain(enDate);
    expect(enRow?.metaLabel).not.toContain(ukDate);
    expect(ukRow?.metaLabel.includes("25.08.2026")).toBe(false);
    expect(enRow?.metaLabel.includes("25.08.2026")).toBe(false);
  });

  it("keeps invalid or empty createdAt as an empty meta fragment", () => {
    const itemMeta = itemCountLabel(2, "uk", ordersUk.items);
    const emptyCards = assistantResultCardsFromParts(
      [
        {
          type: "tool-orders_list_page",
          toolCallId: "call-empty-date",
          state: "output-available",
          output: pageOutput([pageRow(ORDER_A, { createdAt: "" })]),
        },
      ],
      "uk",
    );
    const invalidCards = assistantResultCardsFromParts(
      [
        {
          type: "tool-orders_list_page",
          toolCallId: "call-invalid-date",
          state: "output-available",
          output: pageOutput([pageRow(ORDER_A, { createdAt: "not-a-date" })]),
        },
      ],
      "uk",
    );
    expect(emptyCards.listCard?.rows[0]?.metaLabel).toBe(`#1049 · ${itemMeta}`);
    expect(invalidCards.listCard?.rows[0]?.metaLabel).toBe(
      `#1049 · ${itemMeta}`,
    );
    expect(formatOrderCreatedAt("", "uk")).toBe("");
    expect(formatOrderCreatedAt("not-a-date", "en")).toBe("");
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
    expect(cards.aggregateCard).toBeNull();
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
    expect(cards.aggregateCard).toBeNull();
    expect(cards.entityCards[0]?.statusLabel).toBe(
      ordersUk.statuses.in_progress,
    );
    expect(cards.entityCards[0]?.statusTone).toBe("attention");
    expect(cards.entityCards[1]?.statusLabel).toBe(ordersUk.statuses.done);
    expect(cards.entityCards[1]?.statusTone).toBe("success");
  });
});

const PRODUCT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CUSTOMER_A = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function countsPart(output: Record<string, unknown>): {
  readonly type: "tool-orders_list_counts";
  readonly toolCallId: string;
  readonly state: "output-available";
  readonly output: Record<string, unknown>;
} {
  return {
    type: "tool-orders_list_counts",
    toolCallId: "call-counts",
    state: "output-available",
    output,
  };
}

function assertLabeledBucketList(
  card: NonNullable<
    ReturnType<typeof assistantResultCardsFromParts>["aggregateCard"]
  >,
): void {
  const json = JSON.stringify(card);
  expect(card.kind).toBe("orders-aggregate");
  expect(json.includes("wow")).toBe(false);
  expect(json.includes("barChart")).toBe(false);
  expect(json.includes("chartType")).toBe(false);
  expect(json.includes('"active"')).toBe(false);
  expect("chart" in card).toBe(false);
  expect("wowPercent" in card).toBe(false);
}

describe("assistantResultCardsFromParts aggregate (SHO-370)", () => {
  it("maps period=this_month default groupBy status to one aggregate card", () => {
    const cards = assistantResultCardsFromParts(
      [
        countsPart(
          countsOutput(
            [
              {
                identity: { kind: "status", status: "in_progress" },
                label: "in_progress",
                orderCount: 2,
                grossByCurrency: [
                  { currency: "UAH", grossAmountMinor: "4000" },
                ],
              },
              {
                identity: { kind: "status", status: "new" },
                label: "new",
                orderCount: 3,
                grossByCurrency: [
                  { currency: "UAH", grossAmountMinor: "3000" },
                ],
              },
              {
                identity: { kind: "status", status: "confirmed" },
                label: "confirmed",
                orderCount: 1,
                grossByCurrency: [
                  { currency: "UAH", grossAmountMinor: "1000" },
                ],
              },
            ],
            {
              orderCount: 6,
              grossByCurrency: [{ currency: "UAH", grossAmountMinor: "8000" }],
            },
          ),
        ),
      ],
      "uk",
    );
    const card = cards.aggregateCard;
    expect(cards.listCard).toBeNull();
    expect(card).not.toBeNull();
    if (card === null) {
      return;
    }
    assertLabeledBucketList(card);
    expect(card.groupBy).toBe("status");
    expect(card.orderCountLabel).toBe("6 замовлень");
    expect(card.moneyLabels).toEqual([formatMoneyMinor("8000", "UAH")]);
    expect(card.buckets.map((bucket) => bucket.status)).toEqual([
      "new",
      "confirmed",
      "in_progress",
    ]);
    expect(card.buckets[0]?.label).toBe(ordersUk.statuses.new);
    expect(card.buckets[1]?.label).toBe(ordersUk.statuses.confirmed);
    expect(card.buckets[2]?.label).toBe(ordersUk.statuses.in_progress);
    expect(card.buckets[2]?.statusTone).toBe("attention");
    expect(card.buckets[0]?.statusTone).toBe("action");
    expect(card.emptyTitle).toBeNull();
    expect(cards.entityCards).toEqual([]);
  });

  it("renders groupBy none as a labeled total row, not a chart", () => {
    const cards = assistantResultCardsFromParts(
      [
        countsPart(
          countsOutput(
            [
              {
                identity: { kind: "none" },
                label: "",
                orderCount: 6,
                grossByCurrency: [
                  { currency: "UAH", grossAmountMinor: "8000" },
                ],
              },
            ],
            {
              orderCount: 6,
              grossByCurrency: [{ currency: "UAH", grossAmountMinor: "8000" }],
            },
          ),
        ),
      ],
      "uk",
    );
    const card = cards.aggregateCard;
    expect(cards.listCard).toBeNull();
    expect(card).not.toBeNull();
    if (card === null) {
      return;
    }
    assertLabeledBucketList(card);
    expect(card.groupBy).toBe("none");
    expect(card.buckets).toHaveLength(1);
    expect(card.buckets[0]?.label).toBe(uk.cards.noneBucket);
    expect(card.buckets[0]?.label).toBe("Усього");
    expect(card.buckets[0]?.status).toBeNull();
    expect(card.buckets[0]?.orderCountLabel).toBe("6");
    expect(card.buckets[0]?.moneyLabels).toEqual([
      formatMoneyMinor("8000", "UAH"),
    ]);
  });

  it("never mixes money across currencies", () => {
    const cards = assistantResultCardsFromParts(
      [
        countsPart(
          countsOutput(
            [
              {
                identity: { kind: "none" },
                label: "",
                orderCount: 4,
                grossByCurrency: [
                  { currency: "UAH", grossAmountMinor: "1000" },
                  { currency: "USD", grossAmountMinor: "200" },
                ],
              },
            ],
            {
              orderCount: 4,
              grossByCurrency: [
                { currency: "UAH", grossAmountMinor: "1000" },
                { currency: "USD", grossAmountMinor: "200" },
              ],
            },
          ),
        ),
      ],
      "uk",
    );
    const card = cards.aggregateCard;
    expect(card).not.toBeNull();
    if (card === null) {
      return;
    }
    const uah = formatMoneyMinor("1000", "UAH");
    const usd = formatMoneyMinor("200", "USD");
    expect(card.moneyLabels).toEqual([uah, usd]);
    expect(card.buckets[0]?.moneyLabels).toEqual([uah, usd]);
    expect(card.moneyLabels).toHaveLength(2);
    expect(card.moneyLabels.join("")).not.toBe(formatMoneyMinor("1200", "UAH"));
    expect(JSON.stringify(card).includes("1200")).toBe(false);
  });

  it("surfaces bucketsOmitted and bucketsTruncated as footnotes", () => {
    const cards = assistantResultCardsFromParts(
      [
        countsPart(
          countsOutput(
            [
              {
                identity: {
                  kind: "product",
                  productId: PRODUCT_A,
                  variantId: null,
                },
                label: "Rose",
                orderCount: 2,
                grossByCurrency: [
                  { currency: "UAH", grossAmountMinor: "1000" },
                ],
                quantityMilli: "2000",
              },
            ],
            {
              orderCount: 12,
              bucketsTruncated: true,
              bucketsOmitted: 4,
            },
          ),
        ),
      ],
      "uk",
    );
    const card = cards.aggregateCard;
    expect(card).not.toBeNull();
    if (card === null) {
      return;
    }
    expect(card.footnotes).toContain(uk.cards.bucketsTruncated);
    expect(card.footnotes).toContain("Ще 4 групи не показано.");
    expect("bucketsOmitted" in card).toBe(false);
    expect("bucketsTruncated" in card).toBe(false);
  });

  it("pluralizes bucketsOmitted footnotes (uk one and few)", () => {
    const one = assistantResultCardsFromParts(
      [
        countsPart(
          countsOutput(
            [
              {
                identity: { kind: "none" },
                label: uk.cards.noneBucket,
                orderCount: 2,
                grossByCurrency: [
                  { currency: "UAH", grossAmountMinor: "1000" },
                ],
              },
            ],
            { bucketsOmitted: 1 },
          ),
        ),
      ],
      "uk",
    ).aggregateCard;
    expect(one).not.toBeNull();
    if (one === null) {
      return;
    }
    expect(one.footnotes).toContain("Ще 1 група не показано.");

    const four = assistantResultCardsFromParts(
      [
        countsPart(
          countsOutput(
            [
              {
                identity: { kind: "none" },
                label: uk.cards.noneBucket,
                orderCount: 2,
                grossByCurrency: [
                  { currency: "UAH", grossAmountMinor: "1000" },
                ],
              },
            ],
            { bucketsOmitted: 4 },
          ),
        ),
      ],
      "uk",
    ).aggregateCard;
    expect(four).not.toBeNull();
    if (four === null) {
      return;
    }
    expect(four.footnotes).toContain("Ще 4 групи не показано.");

    const oneEn = assistantResultCardsFromParts(
      [
        countsPart(
          countsOutput(
            [
              {
                identity: { kind: "none" },
                label: uk.cards.noneBucket,
                orderCount: 2,
                grossByCurrency: [
                  { currency: "UAH", grossAmountMinor: "1000" },
                ],
              },
            ],
            { bucketsOmitted: 1 },
          ),
        ),
      ],
      "en",
    ).aggregateCard;
    expect(oneEn).not.toBeNull();
    if (oneEn === null) {
      return;
    }
    expect(oneEn.footnotes).toContain("1 more group is not shown.");
  });

  it("renders empty buckets as honest empty copy, not a chart", () => {
    const cards = assistantResultCardsFromParts(
      [
        countsPart(
          countsOutput([], {
            orderCount: 0,
            grossByCurrency: [],
          }),
        ),
      ],
      "uk",
    );
    const card = cards.aggregateCard;
    expect(cards.listCard).toBeNull();
    expect(card).not.toBeNull();
    if (card === null) {
      return;
    }
    assertLabeledBucketList(card);
    expect(card.buckets).toEqual([]);
    expect(card.emptyTitle).toBe(uk.cards.aggregateEmptyTitle);
    expect(card.emptyDescription).toBe(uk.cards.aggregateEmptyDescription);
    expect(card.orderCountLabel).toBe("0 замовлень");
  });

  it("renders product and customer groupBy as the same labeled rows", () => {
    const productCards = assistantResultCardsFromParts(
      [
        countsPart(
          countsOutput([
            {
              identity: {
                kind: "product",
                productId: PRODUCT_A,
                variantId: null,
              },
              label: "Троянда",
              orderCount: 2,
              grossByCurrency: [{ currency: "UAH", grossAmountMinor: "5000" }],
              quantityMilli: "1500",
            },
          ]),
        ),
      ],
      "uk",
    );
    const customerCards = assistantResultCardsFromParts(
      [
        countsPart(
          countsOutput([
            {
              identity: {
                kind: "customer",
                customerId: CUSTOMER_A,
                nameSnapshot: "Іван",
              },
              label: "Іван",
              orderCount: 3,
              grossByCurrency: [{ currency: "UAH", grossAmountMinor: "7000" }],
            },
          ]),
        ),
      ],
      "uk",
    );
    const product = productCards.aggregateCard;
    const customer = customerCards.aggregateCard;
    expect(product).not.toBeNull();
    expect(customer).not.toBeNull();
    if (product === null || customer === null) {
      return;
    }
    assertLabeledBucketList(product);
    assertLabeledBucketList(customer);
    expect(product.groupBy).toBe("product");
    expect(customer.groupBy).toBe("customer");
    expect(product.kind).toBe(customer.kind);
    expect(product.kind).toBe("orders-aggregate");
    expect(product.buckets[0]?.label).toBe("Троянда");
    expect(product.buckets[0]?.quantityLabel).toBe("1,5");
    expect(product.buckets[0]?.status).toBeNull();
    expect(customer.buckets[0]?.label).toBe("Іван");
    expect(customer.buckets[0]?.quantityLabel).toBeNull();
    expect(customer.buckets[0]?.status).toBeNull();
    expect("chartType" in product).toBe(false);
    expect("chartType" in customer).toBe(false);
  });

  it("keeps one list card and no aggregate when page and counts share a turn", () => {
    const cards = assistantResultCardsFromParts(
      [
        countsPart(
          countsOutput([
            {
              identity: { kind: "status", status: "new" },
              label: "new",
              orderCount: 2,
              grossByCurrency: [],
            },
          ]),
        ),
        {
          type: "tool-orders_list_page",
          toolCallId: "call-page",
          state: "output-available",
          output: pageOutput([pageRow(ORDER_A)]),
        },
      ],
      "uk",
    );
    expect(cards.listCard?.kind).toBe("orders-list");
    expect(cards.aggregateCard).toBeNull();
    expect(cards.entityCards).toEqual([]);
  });

  it("never paints an active chip or invented Active bucket on the aggregate card", () => {
    const cards = assistantResultCardsFromParts(
      [
        countsPart(
          countsOutput([
            {
              identity: { kind: "status", status: "active" },
              label: "active",
              orderCount: 9,
              grossByCurrency: [],
            },
            {
              identity: { kind: "status", status: "in_progress" },
              label: "in_progress",
              orderCount: 2,
              grossByCurrency: [{ currency: "UAH", grossAmountMinor: "1000" }],
            },
            {
              identity: { kind: "status", status: "new" },
              label: "new",
              orderCount: 1,
              grossByCurrency: [{ currency: "UAH", grossAmountMinor: "500" }],
            },
          ]),
        ),
      ],
      "uk",
    );
    const card = cards.aggregateCard;
    expect(card).not.toBeNull();
    if (card === null) {
      return;
    }
    const json = JSON.stringify(card);
    expect(json.includes("active")).toBe(false);
    expect(json.includes("Активн")).toBe(false);
    expect(card.buckets.map((bucket) => bucket.status)).toEqual([
      "new",
      "in_progress",
    ]);
    expect(card.buckets[1]?.label).toBe(ordersUk.statuses.in_progress);
    expect(card.buckets[1]?.label).toBe("В роботі");
    expect(card.buckets.map((bucket) => bucket.label)).not.toContain("Активні");
  });

  it("does not render an aggregate card from a façade error orders_list_counts", () => {
    const output = {
      status: "error" as const,
      code: "PERMISSION_DENIED",
      message: "Staff cannot count these orders",
    };
    expect(isToolErrorOutput(output)).toBe(true);
    const cards = assistantResultCardsFromParts([countsPart(output)], "uk");
    expect(cards.listCard).toBeNull();
    expect(cards.aggregateCard).toBeNull();
    expect(cards.entityCards).toEqual([]);
  });

  it("localizes unlinked customer buckets and in_progress status copy", () => {
    const cards = assistantResultCardsFromParts(
      [
        countsPart(
          countsOutput([
            {
              identity: {
                kind: "customer",
                customerId: null,
                nameSnapshot: "unlinked",
              },
              label: "unlinked",
              orderCount: 1,
              grossByCurrency: [],
            },
          ]),
        ),
      ],
      "uk",
    );
    expect(cards.aggregateCard?.buckets[0]?.label).toBe(
      ordersUk.missingCustomer,
    );
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
    const aggregateCard = readFileSync(
      new URL("../sheet/orders-aggregate-result-card.tsx", import.meta.url),
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
    expect(aggregateCard).toContain("Card");
    expect(aggregateCard).toContain("StatusPill");
    expect(aggregateCard).toContain('from "../../../components/ui"');
    expect(aggregateCard.includes("orders-list-screen")).toBe(false);
    expect(aggregateCard.includes("order-row")).toBe(false);
    expect(aggregateCard.includes("BarChart")).toBe(false);
    expect(aggregateCard.includes("wow")).toBe(false);
    expect(messageRow.includes("orders-list-screen")).toBe(false);
    expect(messageRow.includes("order-row")).toBe(false);
    expect(hook).toContain("orderDetailHref");
    expect(hook).toContain("ASSISTANT_ORDERS_LIST_HREF");
    expect(hook.includes("orders-list-screen")).toBe(false);
    expect(hook.includes("order-row")).toBe(false);
    expect(mapper.includes('from "@showzy/ai"')).toBe(false);
    expect(mapper.includes('from "@showzy/core"')).toBe(false);
    expect(mapper.includes('from "../../orders/list')).toBe(false);
    expect(mapper).toContain("formatOrderCreatedAt");
    expect(mapper).toContain("../../orders/shared/order-created-at");
    expect(mapper).not.toContain("extractUuidResultIds");
    expect(mapper).not.toContain("sit.svg");
    expect(mapper).not.toContain("dig.svg");
    expect(listCard).not.toContain("sit.svg");
    expect(listCard).not.toContain("listen.svg");
    expect(aggregateCard).not.toContain("sit.svg");
    expect(aggregateCard).not.toContain("dig.svg");
    expect(aggregateCard).not.toContain("listen.svg");
  });
});
