import { describe, expect, it } from "vitest";

import { STAFF_ASSISTANT_CLIPPED_STATUS } from "./clip-tool-result.js";
import { STAFF_ASSISTANT_CONFIRMATION_FALLBACK_TEXT } from "./confirmation.js";
import {
  presentCompletedStaffAssistantTurn,
  staffAssistantPersistedTurnText,
  staffAssistantTurnUsesCompletedPresenter,
  STAFF_ASSISTANT_DEFAULT_LOCALE,
} from "./presenter.js";
import { STAFF_ASSISTANT_SUCCESS_SPOKEN_FALLBACK } from "./spoken-reply.js";
import { ORDERS_CREATE_TOOL_NAME } from "./tool-facades/orders-create.js";
import {
  ORDERS_LIST_COUNTS_TOOL_NAME,
  ORDERS_LIST_PAGE_TOOL_NAME,
} from "./tool-facades/orders-list.js";

const ORDER_A = "11111111-1111-4111-8111-111111111111";
const ORDER_B = "22222222-2222-4222-8222-222222222222";

const listPage = {
  kind: "page.summary" as const,
  requestedLimit: 2,
  rows: [
    {
      orderId: ORDER_A,
      orderNumber: "1049",
      status: "new",
      customer: { nameSnapshot: "Albina", linkedCustomerId: ORDER_A },
    },
    {
      orderId: ORDER_B,
      orderNumber: "1050",
      status: "confirmed",
      customer: { nameSnapshot: "Ivan", linkedCustomerId: ORDER_B },
    },
  ],
  hasMore: false,
  nextCursor: null,
  customerMatchTruncated: false,
};

describe("presentCompletedStaffAssistantTurn", () => {
  it("presents a list page in Ukrainian and English", () => {
    const results = [
      { toolName: ORDERS_LIST_PAGE_TOOL_NAME, output: listPage },
    ];
    expect(
      presentCompletedStaffAssistantTurn({
        locale: "uk",
        toolResults: results,
      }),
    ).toBe("Останні замовлення: #1049 (Нове), #1050 (Підтверджено).");
    expect(
      presentCompletedStaffAssistantTurn({
        locale: "en",
        toolResults: results,
      }),
    ).toBe("Latest orders: #1049 (New), #1050 (Confirmed).");
  });

  it("presents an empty page", () => {
    const results = [
      {
        toolName: ORDERS_LIST_PAGE_TOOL_NAME,
        output: {
          kind: "page.summary",
          rows: [],
          hasMore: false,
          nextCursor: null,
        },
      },
    ];
    expect(
      presentCompletedStaffAssistantTurn({
        locale: "uk",
        toolResults: results,
      }),
    ).toBe("Немає замовлень.");
    expect(
      presentCompletedStaffAssistantTurn({
        locale: "en",
        toolResults: results,
      }),
    ).toBe("No orders.");
  });

  it("appends a hasMore footnote when nextCursor is set", () => {
    const results = [
      {
        toolName: ORDERS_LIST_PAGE_TOOL_NAME,
        output: { ...listPage, hasMore: true, nextCursor: "cursor-1" },
      },
    ];
    expect(
      presentCompletedStaffAssistantTurn({
        locale: "uk",
        toolResults: results,
      }),
    ).toBe(
      "Останні замовлення: #1049 (Нове), #1050 (Підтверджено). Є ще замовлення.",
    );
    expect(
      presentCompletedStaffAssistantTurn({
        locale: "en",
        toolResults: results,
      }),
    ).toBe(
      "Latest orders: #1049 (New), #1050 (Confirmed). There are more orders.",
    );
  });

  it("speaks rows.length labels and hasMore from the completed view", () => {
    const rows = [
      { orderNumber: "1", status: "new" },
      { orderNumber: "2", status: "confirmed" },
      { orderNumber: "3", status: "done" },
    ];
    const results = [
      {
        toolName: ORDERS_LIST_PAGE_TOOL_NAME,
        output: {
          kind: "page.summary",
          requestedLimit: 3,
          rows,
          hasMore: true,
          nextCursor: "more",
        },
      },
    ];
    const spoken = presentCompletedStaffAssistantTurn({
      locale: "en",
      toolResults: results,
    });
    expect(spoken).toBe(
      "Latest orders: #1 (New), #2 (Confirmed), #3 (Done). There are more orders.",
    );
    expect(spoken).not.toContain("requestedLimit");
    expect(spoken).not.toContain("3 orders");
  });

  it("lists all default-20 rows and omits hasMore when the view says false", () => {
    const rows = Array.from({ length: 20 }, (_, index) => ({
      orderNumber: String(1000 + index),
      status: "new" as const,
    }));
    const spoken = presentCompletedStaffAssistantTurn({
      locale: "en",
      toolResults: [
        {
          toolName: ORDERS_LIST_PAGE_TOOL_NAME,
          output: {
            kind: "page.summary",
            requestedLimit: 20,
            rows,
            hasMore: false,
            nextCursor: null,
          },
        },
      ],
    });
    expect(spoken).toContain("#1000 (New)");
    expect(spoken).toContain("#1019 (New)");
    expect(spoken).not.toContain("There are more orders.");
    expect(spoken?.split(", ").length).toBe(20);
  });

  it("treats a clipped list preview as hasMore", () => {
    const results = [
      {
        toolName: ORDERS_LIST_PAGE_TOOL_NAME,
        output: {
          status: STAFF_ASSISTANT_CLIPPED_STATUS,
          preview: listPage,
          omitted: 2,
        },
      },
    ];
    expect(
      presentCompletedStaffAssistantTurn({
        locale: "en",
        toolResults: results,
      }),
    ).toContain("There are more orders.");
  });

  it("presents a counts-only aggregate", () => {
    const results = [
      {
        toolName: ORDERS_LIST_COUNTS_TOOL_NAME,
        output: {
          kind: "aggregate",
          orderCount: 6,
          grossByCurrency: [],
          buckets: [
            {
              identity: { kind: "status", status: "confirmed" },
              orderCount: 4,
            },
            {
              identity: { kind: "status", status: "new" },
              orderCount: 2,
            },
          ],
        },
      },
    ];
    expect(
      presentCompletedStaffAssistantTurn({
        locale: "uk",
        toolResults: results,
      }),
    ).toBe("6 замовлень. Нове · 2, Підтверджено · 4.");
    expect(
      presentCompletedStaffAssistantTurn({
        locale: "en",
        toolResults: results,
      }),
    ).toBe("6 orders. New · 2, Confirmed · 4.");
  });

  it("presents an empty aggregate", () => {
    const results = [
      {
        toolName: ORDERS_LIST_COUNTS_TOOL_NAME,
        output: {
          kind: "aggregate",
          orderCount: 0,
          grossByCurrency: [],
          buckets: [],
        },
      },
    ];
    expect(
      presentCompletedStaffAssistantTurn({
        locale: "uk",
        toolResults: results,
      }),
    ).toBe("Немає замовлень.");
  });

  it("does not emit aggregate spoken when a list page is on the same turn", () => {
    const results = [
      {
        toolName: ORDERS_LIST_COUNTS_TOOL_NAME,
        output: {
          kind: "aggregate",
          orderCount: 6,
          buckets: [],
        },
      },
      { toolName: ORDERS_LIST_PAGE_TOOL_NAME, output: listPage },
    ];
    expect(
      presentCompletedStaffAssistantTurn({
        locale: "en",
        toolResults: results,
      }),
    ).toBe("Latest orders: #1049 (New), #1050 (Confirmed).");
  });

  it("presents an order entity", () => {
    const results = [
      {
        toolName: "orders_get",
        output: {
          orderId: ORDER_A,
          orderNumber: "1049",
          status: "new",
          customer: { nameSnapshot: "Albina" },
        },
      },
    ];
    expect(
      presentCompletedStaffAssistantTurn({
        locale: "uk",
        toolResults: results,
      }),
    ).toBe("Замовлення #1049, Albina, Нове.");
    expect(
      presentCompletedStaffAssistantTurn({
        locale: "en",
        toolResults: results,
      }),
    ).toBe("Order #1049, Albina, New.");
  });

  it("joins multiple registered surfaces in tool-result order", () => {
    const results = [
      {
        toolName: "orders_get",
        output: {
          orderId: ORDER_A,
          orderNumber: "1049",
          status: "new",
        },
      },
      { toolName: ORDERS_LIST_PAGE_TOOL_NAME, output: listPage },
      {
        toolName: ORDERS_CREATE_TOOL_NAME,
        output: {
          orderId: ORDER_B,
          orderNumber: "1050",
          status: "confirmed",
        },
      },
    ];
    expect(
      presentCompletedStaffAssistantTurn({
        locale: "en",
        toolResults: results,
      }),
    ).toBe(
      "Order #1049, New.\nLatest orders: #1049 (New), #1050 (Confirmed).\nOrder #1050, Confirmed.",
    );
  });

  it("returns undefined when there is no registered surface", () => {
    expect(
      presentCompletedStaffAssistantTurn({
        locale: STAFF_ASSISTANT_DEFAULT_LOCALE,
        toolResults: [
          {
            toolName: "catalog_list_products",
            output: { items: [], nextCursor: null },
          },
        ],
      }),
    ).toBeUndefined();
  });
});

describe("staffAssistantTurnUsesCompletedPresenter", () => {
  it("is true for a completed list and false when HITL is on the turn", () => {
    const toolResults = [
      { toolName: ORDERS_LIST_PAGE_TOOL_NAME, output: listPage },
    ];
    expect(
      staffAssistantTurnUsesCompletedPresenter({
        locale: "uk",
        toolResults,
        runs: [{ outcome: "success" }],
      }),
    ).toBe(true);
    expect(
      staffAssistantTurnUsesCompletedPresenter({
        locale: "uk",
        toolResults,
        runs: [{ outcome: "success" }, { outcome: "confirmation_required" }],
      }),
    ).toBe(false);
  });

  it("is false when there is no registered surface", () => {
    expect(
      staffAssistantTurnUsesCompletedPresenter({
        locale: "uk",
        toolResults: [],
        runs: [{ outcome: "success" }],
      }),
    ).toBe(false);
  });
});

describe("staffAssistantPersistedTurnText", () => {
  it("uses the presenter when a list surface exists, not model spoken", () => {
    const presented = presentCompletedStaffAssistantTurn({
      locale: "en",
      toolResults: [{ toolName: ORDERS_LIST_PAGE_TOOL_NAME, output: listPage }],
    });
    expect(
      staffAssistantPersistedTurnText({
        locale: "en",
        toolResults: [
          { toolName: ORDERS_LIST_PAGE_TOOL_NAME, output: listPage },
        ],
        parsedSpoken: "MODEL_SPOKEN_SHOULD_NOT_PERSIST",
        rawText: '{"spoken":"MODEL_SPOKEN_SHOULD_NOT_PERSIST"}',
        runs: [{ outcome: "success" }],
      }),
    ).toBe(presented);
    expect(presented).not.toBe("MODEL_SPOKEN_SHOULD_NOT_PERSIST");
  });

  it("keeps model spoken when there is no registered surface", () => {
    expect(
      staffAssistantPersistedTurnText({
        locale: "uk",
        toolResults: [],
        parsedSpoken: "Four orders this week.",
        rawText: '{"spoken":"Four orders this week."}',
        runs: [{ outcome: "success" }],
      }),
    ).toBe("Four orders this week.");
  });

  it("keeps confirmation fallback over a completed list when spoken is a markdown dump", () => {
    expect(
      staffAssistantPersistedTurnText({
        locale: "en",
        toolResults: [
          { toolName: ORDERS_LIST_PAGE_TOOL_NAME, output: listPage },
        ],
        parsedSpoken: "| order | total |",
        rawText: '{"spoken":"| order | total |"}',
        runs: [{ outcome: "success" }, { outcome: "confirmation_required" }],
      }),
    ).toBe(STAFF_ASSISTANT_CONFIRMATION_FALLBACK_TEXT);
    expect(
      presentCompletedStaffAssistantTurn({
        locale: "en",
        toolResults: [
          { toolName: ORDERS_LIST_PAGE_TOOL_NAME, output: listPage },
        ],
      }),
    ).not.toBe(STAFF_ASSISTANT_CONFIRMATION_FALLBACK_TEXT);
  });

  it("still fail-opens markdown spoken when there is no surface", () => {
    expect(
      staffAssistantPersistedTurnText({
        locale: "uk",
        toolResults: [],
        parsedSpoken: "| order | total |",
        rawText: '{"spoken":"| order | total |"}',
        runs: [{ outcome: "success" }],
      }),
    ).toBe(STAFF_ASSISTANT_SUCCESS_SPOKEN_FALLBACK);
  });
});
