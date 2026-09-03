import { describe, expect, it } from "vitest";

import { assistantCopy } from "../../../i18n/assistant";
import { assistantChatRows, assistantRowHasInFlightTools } from "./chat-rows";
import type { PendingConfirmation } from "./confirmation-presenter";

const copy = assistantCopy("uk");

const pending: PendingConfirmation = {
  status: "confirmation_required",
  challengeId: "22222222-2222-4222-8222-222222222222",
  summary: "Delete this archived customer.",
  expiresAt: "2026-09-01T12:00:00.000Z",
  actionName: "customers.deleteCustomer",
  toolCallId: "call-delete",
  messageId: "a1",
};

const hitlToolOutput = {
  status: "confirmation_required" as const,
  challengeId: pending.challengeId,
  summary: pending.summary,
  expiresAt: pending.expiresAt,
  actionName: pending.actionName,
  toolCallId: pending.toolCallId,
};

const pageOutput = {
  kind: "page.summary",
  items: [
    {
      orderId: "ord-1",
      orderNumber: "1049",
      totalGrossMinor: 33000,
    },
  ],
};

describe("assistantChatRows", () => {
  it("attaches the pending confirmation to the matching assistant row", () => {
    expect(
      assistantChatRows(
        [
          {
            id: "u1",
            role: "user",
            parts: [{ type: "text", text: "Delete the customer" }],
          },
          {
            id: "a1",
            role: "assistant",
            parts: [{ type: "text", text: "Confirmation required." }],
          },
        ],
        pending,
        copy,
      ),
    ).toEqual([
      {
        id: "u1",
        role: "user",
        text: "Delete the customer",
        confirmation: null,
        timeline: [],
        listCard: null,
        aggregateCard: null,
        entityCards: [],
      },
      {
        id: "a1",
        role: "assistant",
        text: "Confirmation required.",
        confirmation: pending,
        timeline: [],
        listCard: null,
        aggregateCard: null,
        entityCards: [],
      },
    ]);
  });

  it("keeps an empty-text in-flight tool row", () => {
    const rows = assistantChatRows(
      [
        {
          id: "u1",
          role: "user",
          parts: [{ type: "text", text: "Замовлення в роботі" }],
        },
        {
          id: "a1",
          role: "assistant",
          parts: [
            {
              type: "tool-orders_list_page",
              toolCallId: "call-page",
              state: "input-available",
            },
          ],
        },
      ],
      null,
      copy,
    );
    expect(rows).toHaveLength(2);
    const inFlightRow = {
      id: "a1",
      role: "assistant" as const,
      text: "",
      confirmation: null,
      timeline: [
        {
          id: "call-page",
          label: "Шукаю замовлення",
          status: "running" as const,
        },
      ],
      listCard: null,
      aggregateCard: null,
      entityCards: [],
    };
    expect(rows[1]).toEqual(inFlightRow);
    expect(assistantRowHasInFlightTools(inFlightRow)).toBe(true);
  });

  it("keeps an empty-text row after the tool result arrives", () => {
    const rows = assistantChatRows(
      [
        {
          id: "a1",
          role: "assistant",
          parts: [
            {
              type: "tool-orders_list_counts",
              toolCallId: "call-counts",
              state: "output-available",
              output: { kind: "aggregate", orderCount: 6 },
            },
          ],
        },
      ],
      null,
      copy,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.text).toBe("");
    expect(rows[0]?.confirmation).toBeNull();
    expect(rows[0]?.timeline).toEqual([
      {
        id: "call-counts",
        label: "Рахую виторг",
        status: "done",
      },
    ]);
    expect(rows[0]?.listCard).toBeNull();
    expect(rows[0]?.aggregateCard?.kind).toBe("orders-aggregate");
    expect(rows[0]?.entityCards).toEqual([]);
    const doneRow = rows[0];
    expect(doneRow).toBeDefined();
    if (doneRow === undefined) {
      return;
    }
    expect(assistantRowHasInFlightTools(doneRow)).toBe(false);
    expect(doneRow.text.includes("aggregate")).toBe(false);
    expect(doneRow.text.includes("orderCount")).toBe(false);
  });

  it("does not stringify tool JSON into the bubble text", () => {
    const rows = assistantChatRows(
      [
        {
          id: "a1",
          role: "assistant",
          parts: [
            { type: "text", text: "Ось що знайшла." },
            {
              type: "tool-orders_list_page",
              toolCallId: "call-page",
              state: "output-available",
              output: pageOutput,
            },
          ],
        },
      ],
      null,
      copy,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.text).toBe("Ось що знайшла.");
    expect(rows[0]?.text.includes("page.summary")).toBe(false);
    expect(rows[0]?.text.includes("totalGrossMinor")).toBe(false);
    expect(JSON.stringify(rows[0]?.timeline).includes("page.summary")).toBe(
      false,
    );
    expect(rows[0]?.timeline[0]?.label).toBe("Шукаю замовлення");
    expect(rows[0]?.timeline[0]?.label.includes("orders_list_page")).toBe(
      false,
    );
    expect(rows[0]?.listCard?.kind).toBe("orders-list");
    expect(JSON.stringify(rows[0]?.text).includes("page.summary")).toBe(false);
  });

  it("still attaches HITL data-confirmation to the matching assistant row with tools", () => {
    const rows = assistantChatRows(
      [
        {
          id: "a1",
          role: "assistant",
          parts: [
            { type: "data-confirmation", data: pending },
            {
              type: "tool-customers.deleteCustomer",
              toolCallId: "call-delete",
              state: "input-available",
            },
          ],
        },
      ],
      pending,
      copy,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.confirmation).toEqual(pending);
    expect(rows[0]?.text).toBe("");
    expect(rows[0]?.timeline).toEqual([
      {
        id: "call-delete",
        label: "Працюю",
        status: "running",
      },
    ]);
  });

  it("still drops empty-text messages with no confirmation and no tools", () => {
    expect(
      assistantChatRows(
        [
          {
            id: "a1",
            role: "assistant",
            parts: [{ type: "text", text: "" }],
          },
        ],
        null,
        copy,
      ),
    ).toEqual([]);
  });

  it("keeps HITL output-available in-flight and bound while pending", () => {
    const rows = assistantChatRows(
      [
        {
          id: "a1",
          role: "assistant",
          parts: [
            { type: "data-confirmation", data: pending },
            {
              type: "tool-customers.deleteCustomer",
              toolCallId: "call-delete",
              state: "output-available",
              output: hitlToolOutput,
            },
          ],
        },
      ],
      pending,
      copy,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.confirmation).toEqual(pending);
    expect(rows[0]?.timeline).toEqual([
      {
        id: "call-delete",
        label: "Працюю",
        status: "running",
      },
    ]);
    const pendingHitlRow = rows[0];
    expect(pendingHitlRow).toBeDefined();
    if (pendingHitlRow === undefined) {
      return;
    }
    expect(assistantRowHasInFlightTools(pendingHitlRow)).toBe(true);
    expect(pendingHitlRow.text.includes("confirmation_required")).toBe(false);
    expect(
      JSON.stringify(pendingHitlRow.timeline).includes("confirmation_required"),
    ).toBe(false);
    expect(
      JSON.stringify(pendingHitlRow.timeline).includes(pending.summary),
    ).toBe(false);
  });

  it("omits a dismissed HITL timeline step and drops the empty row", () => {
    expect(
      assistantChatRows(
        [
          {
            id: "a1",
            role: "assistant",
            parts: [
              { type: "data-confirmation", data: pending },
              {
                type: "tool-customers.deleteCustomer",
                toolCallId: "call-delete",
                state: "output-available",
                output: hitlToolOutput,
              },
            ],
          },
        ],
        null,
        copy,
        new Set([pending.challengeId]),
      ),
    ).toEqual([]);
  });

  it("omits a dismissed in-flight HITL step matched by data-confirmation toolCallId", () => {
    expect(
      assistantChatRows(
        [
          {
            id: "a1",
            role: "assistant",
            parts: [
              { type: "data-confirmation", data: pending },
              {
                type: "tool-customers.deleteCustomer",
                toolCallId: "call-delete",
                state: "input-available",
              },
            ],
          },
        ],
        null,
        copy,
        new Set([pending.challengeId]),
      ),
    ).toEqual([]);
  });

  it("keeps other tools after omitting a dismissed HITL step", () => {
    const rows = assistantChatRows(
      [
        {
          id: "a1",
          role: "assistant",
          parts: [
            {
              type: "tool-orders_list_counts",
              toolCallId: "call-counts",
              state: "output-available",
              output: { kind: "aggregate", orderCount: 6 },
            },
            { type: "data-confirmation", data: pending },
            {
              type: "tool-customers.deleteCustomer",
              toolCallId: "call-delete",
              state: "output-available",
              output: hitlToolOutput,
            },
          ],
        },
      ],
      null,
      copy,
      new Set([pending.challengeId]),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.text).toBe("");
    expect(rows[0]?.confirmation).toBeNull();
    expect(rows[0]?.timeline).toEqual([
      {
        id: "call-counts",
        label: "Рахую виторг",
        status: "done",
      },
    ]);
    expect(rows[0]?.listCard).toBeNull();
    expect(rows[0]?.aggregateCard?.kind).toBe("orders-aggregate");
    expect(rows[0]?.entityCards).toEqual([]);
    const remainingRow = rows[0];
    expect(remainingRow).toBeDefined();
    if (remainingRow === undefined) {
      return;
    }
    expect(assistantRowHasInFlightTools(remainingRow)).toBe(false);
  });

  it("attaches one list card for page + counts and one aggregate card for counts-only", () => {
    const pageAndCounts = assistantChatRows(
      [
        {
          id: "a1",
          role: "assistant",
          parts: [
            {
              type: "tool-orders_list_counts",
              toolCallId: "call-counts",
              state: "output-available",
              output: {
                kind: "aggregate",
                buckets: [
                  {
                    identity: { kind: "status", status: "new" },
                    orderCount: 1,
                  },
                ],
              },
            },
            {
              type: "tool-orders_list_page",
              toolCallId: "call-page",
              state: "output-available",
              output: {
                kind: "page.summary",
                items: [
                  {
                    orderId: "0f0e2d5c-4a1b-4c3d-9e8f-102938475601",
                    orderNumber: "1049",
                    customer: { nameSnapshot: "Іван", linkedCustomerId: null },
                    status: "new",
                    itemCount: 1,
                    totalGrossMinor: "1000",
                    currency: "UAH",
                    createdAt: "2026-09-03T10:00:00.000Z",
                  },
                ],
                nextCursor: null,
                customerMatchTruncated: false,
              },
            },
          ],
        },
      ],
      null,
      copy,
    );
    expect(pageAndCounts[0]?.listCard?.kind).toBe("orders-list");
    expect(pageAndCounts[0]?.listCard?.chips).toHaveLength(1);
    expect(pageAndCounts[0]?.aggregateCard).toBeNull();
    expect(pageAndCounts[0]?.entityCards).toEqual([]);

    const countsOnly = assistantChatRows(
      [
        {
          id: "a1",
          role: "assistant",
          parts: [
            {
              type: "tool-orders_list_counts",
              toolCallId: "call-counts",
              state: "output-available",
              output: { kind: "aggregate", orderCount: 6 },
            },
          ],
        },
      ],
      null,
      copy,
    );
    expect(countsOnly[0]?.listCard).toBeNull();
    expect(countsOnly[0]?.aggregateCard?.kind).toBe("orders-aggregate");
    expect(countsOnly[0]?.entityCards).toEqual([]);
  });

  it("keeps a successful tool result after the HITL challenge is resolved", () => {
    const rows = assistantChatRows(
      [
        {
          id: "a1",
          role: "assistant",
          parts: [
            { type: "data-confirmation", data: pending },
            {
              type: "tool-customers.deleteCustomer",
              toolCallId: "call-delete",
              state: "output-available",
              output: { deleted: true },
            },
          ],
        },
      ],
      null,
      copy,
      new Set([pending.challengeId]),
    );
    expect(rows).toEqual([
      {
        id: "a1",
        role: "assistant",
        text: "",
        confirmation: null,
        timeline: [
          {
            id: "call-delete",
            label: "Працюю",
            status: "done",
          },
        ],
        listCard: null,
        aggregateCard: null,
        entityCards: [],
      },
    ]);
  });
});
