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
      },
      {
        id: "a1",
        role: "assistant",
        text: "Confirmation required.",
        confirmation: pending,
        timeline: [],
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
    const doneRow = {
      id: "a1",
      role: "assistant" as const,
      text: "",
      confirmation: null,
      timeline: [
        {
          id: "call-counts",
          label: "Рахую виторг",
          status: "done" as const,
        },
      ],
    };
    expect(rows).toEqual([doneRow]);
    expect(assistantRowHasInFlightTools(doneRow)).toBe(false);
    expect(JSON.stringify(rows).includes("aggregate")).toBe(false);
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
});
