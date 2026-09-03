import { describe, expect, it } from "vitest";

import { STAFF_ASSISTANT_CONFIRMATION_FALLBACK_TEXT } from "./confirmation.js";
import {
  createSpokenReplyUiTransform,
  isStaffAssistantSyntheticJsonTool,
  spokenContainsMarkdownDump,
  spokenFromModelText,
  spokenPrefixFromPartialJson,
  spokenTurnText,
  staffAssistantSpokenOutputSchema,
  STAFF_ASSISTANT_SUCCESS_SPOKEN_FALLBACK,
  STAFF_ASSISTANT_SYNTHETIC_JSON_TOOL_NAME,
} from "./spoken-reply.js";

describe("staffAssistantSpokenOutputSchema", () => {
  it("accepts spoken only and rejects card-protocol fields", () => {
    expect(
      staffAssistantSpokenOutputSchema.parse({
        spoken: "Four orders this week.",
      }),
    ).toEqual({ spoken: "Four orders this week." });
    expect(
      staffAssistantSpokenOutputSchema.safeParse({
        spoken: "Four orders this week.",
        rows: [{ orderId: "x" }],
      }).success,
    ).toBe(false);
    expect(
      staffAssistantSpokenOutputSchema.safeParse({
        spoken: "Four orders this week.",
        cards: [],
      }).success,
    ).toBe(false);
    expect(Object.keys(staffAssistantSpokenOutputSchema.shape)).toEqual([
      "spoken",
    ]);
  });
});

describe("spokenFromModelText", () => {
  it("reads spoken and ignores prose or invalid JSON", () => {
    expect(spokenFromModelText('{"spoken":"Hi"}')).toBe("Hi");
    expect(spokenFromModelText("You have no orders.")).toBeUndefined();
    expect(spokenFromModelText("{")).toBeUndefined();
  });
});

describe("spokenPrefixFromPartialJson", () => {
  it("extracts a growing spoken prefix from partial JSON", () => {
    expect(spokenPrefixFromPartialJson('{"spoken":"Alb')).toBe("Alb");
    expect(spokenPrefixFromPartialJson('{"spoken":"Albina has 4"}')).toBe(
      "Albina has 4",
    );
  });
});

describe("spokenTurnText", () => {
  it("prefers parsed spoken over raw JSON", () => {
    expect(
      spokenTurnText({
        parsedSpoken: "Albina has 4 orders this week.",
        rawText: '{"spoken":"Albina has 4 orders this week."}',
        runs: [{ outcome: "success" }],
      }),
    ).toBe("Albina has 4 orders this week.");
  });

  it("fail-opens markdown dumps after a successful list, never Done", () => {
    expect(spokenContainsMarkdownDump("| order | total |\n|---|---|")).toBe(
      true,
    );
    expect(
      spokenTurnText({
        parsedSpoken: "| order | total |\n| **new** | 1 |",
        rawText: '{"spoken":"| order | total |"}',
        runs: [{ outcome: "success" }],
      }),
    ).toBe(STAFF_ASSISTANT_SUCCESS_SPOKEN_FALLBACK);
    expect(
      spokenTurnText({
        parsedSpoken: undefined,
        rawText: "",
        runs: [{ outcome: "success" }],
      }),
    ).toBe(STAFF_ASSISTANT_SUCCESS_SPOKEN_FALLBACK);
  });

  it("lets confirmation_required win over markdown fail-open after a successful list", () => {
    expect(
      spokenTurnText({
        parsedSpoken: "| order | total |\n| **new** | 1 |",
        rawText: '{"spoken":"| order | total |"}',
        runs: [{ outcome: "success" }, { outcome: "confirmation_required" }],
      }),
    ).toBe(STAFF_ASSISTANT_CONFIRMATION_FALLBACK_TEXT);
    expect(
      spokenTurnText({
        parsedSpoken: "| order | total |\n| **new** | 1 |",
        rawText: '{"spoken":"| order | total |"}',
        runs: [{ outcome: "success" }, { outcome: "confirmation_required" }],
      }),
    ).not.toBe(STAFF_ASSISTANT_SUCCESS_SPOKEN_FALLBACK);
  });

  it("keeps the HITL confirmation fallback when JSON is skipped", () => {
    expect(
      spokenTurnText({
        parsedSpoken: undefined,
        rawText: "",
        runs: [{ outcome: "confirmation_required" }],
      }),
    ).toBe(STAFF_ASSISTANT_CONFIRMATION_FALLBACK_TEXT);
  });

  it("keeps plain prose when structured output is missing", () => {
    expect(
      spokenTurnText({
        parsedSpoken: undefined,
        rawText: "You have no orders.",
        runs: [{ outcome: "success" }],
      }),
    ).toBe("You have no orders.");
  });

  it("fail-opens a non-JSON markdown table after a successful list, never Done", () => {
    expect(
      spokenTurnText({
        parsedSpoken: undefined,
        rawText: "| order | total |",
        runs: [{ outcome: "success" }],
      }),
    ).toBe(STAFF_ASSISTANT_SUCCESS_SPOKEN_FALLBACK);
    expect(
      spokenTurnText({
        parsedSpoken: undefined,
        rawText: "| order | total |",
        runs: [{ outcome: "success" }, { outcome: "confirmation_required" }],
      }),
    ).toBe(STAFF_ASSISTANT_CONFIRMATION_FALLBACK_TEXT);
  });
});

describe("createSpokenReplyUiTransform", () => {
  it("flattens spoken JSON deltas and drops the json tool", async () => {
    const transform = createSpokenReplyUiTransform();
    const writer = transform.writable.getWriter();
    const reader = transform.readable.getReader();
    const parts: unknown[] = [];
    const read = (async () => {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        parts.push(value);
      }
    })();
    await writer.write({
      type: "tool-input-start",
      id: "call-json",
      toolName: STAFF_ASSISTANT_SYNTHETIC_JSON_TOOL_NAME,
    });
    await writer.write({
      type: "tool-call",
      toolCallId: "call-json",
      toolName: STAFF_ASSISTANT_SYNTHETIC_JSON_TOOL_NAME,
    });
    await writer.write({ type: "text-start", id: "t" });
    await writer.write({
      type: "text-delta",
      id: "t",
      text: '{"spoken":"Four orders this week."}',
    });
    await writer.write({ type: "text-end", id: "t" });
    await writer.write({
      type: "tool-orders_list_page",
      toolCallId: "call-list",
    });
    await writer.close();
    await read;
    expect(isStaffAssistantSyntheticJsonTool("json")).toBe(true);
    expect(JSON.stringify(parts)).not.toContain("call-json");
    expect(JSON.stringify(parts)).not.toContain('{"spoken"');
    expect(parts).toEqual(
      expect.arrayContaining([
        { type: "text-start", id: "t" },
        {
          type: "text-delta",
          id: "t",
          text: "Four orders this week.",
        },
        { type: "text-end", id: "t" },
        { type: "tool-orders_list_page", toolCallId: "call-list" },
      ]),
    );
  });

  it("fail-opens a markdown dump to the short spoken fallback", async () => {
    const transform = createSpokenReplyUiTransform();
    const writer = transform.writable.getWriter();
    const reader = transform.readable.getReader();
    const parts: unknown[] = [];
    const read = (async () => {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        parts.push(value);
      }
    })();
    await writer.write({ type: "text-start", id: "t" });
    await writer.write({
      type: "text-delta",
      id: "t",
      text: '{"spoken":"| order | **total** |"}',
    });
    await writer.write({ type: "text-end", id: "t" });
    await writer.close();
    await read;
    expect(JSON.stringify(parts)).toContain(
      STAFF_ASSISTANT_SUCCESS_SPOKEN_FALLBACK,
    );
    expect(JSON.stringify(parts)).not.toContain("| order");
    expect(JSON.stringify(parts)).not.toContain("**total**");
  });

  it("fail-opens a non-JSON markdown table to the short spoken fallback", async () => {
    const transform = createSpokenReplyUiTransform({
      runs: [{ outcome: "success" }],
    });
    const writer = transform.writable.getWriter();
    const reader = transform.readable.getReader();
    const parts: unknown[] = [];
    const read = (async () => {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        parts.push(value);
      }
    })();
    await writer.write({ type: "text-start", id: "t" });
    await writer.write({
      type: "text-delta",
      id: "t",
      text: "| order | total |",
    });
    await writer.write({ type: "text-end", id: "t" });
    await writer.close();
    await read;
    expect(JSON.stringify(parts)).toContain(
      STAFF_ASSISTANT_SUCCESS_SPOKEN_FALLBACK,
    );
    expect(JSON.stringify(parts)).not.toContain("| order");
  });

  it("fail-opens markdown to the confirmation line when HITL is on the turn", async () => {
    const transform = createSpokenReplyUiTransform({
      runs: [{ outcome: "success" }, { outcome: "confirmation_required" }],
    });
    const writer = transform.writable.getWriter();
    const reader = transform.readable.getReader();
    const parts: unknown[] = [];
    const read = (async () => {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        parts.push(value);
      }
    })();
    await writer.write({ type: "text-start", id: "t" });
    await writer.write({
      type: "text-delta",
      id: "t",
      text: '{"spoken":"| order | **total** |"}',
    });
    await writer.write({ type: "text-end", id: "t" });
    await writer.close();
    await read;
    expect(JSON.stringify(parts)).toContain(
      STAFF_ASSISTANT_CONFIRMATION_FALLBACK_TEXT,
    );
    expect(JSON.stringify(parts)).not.toContain(
      STAFF_ASSISTANT_SUCCESS_SPOKEN_FALLBACK,
    );
    expect(JSON.stringify(parts)).not.toContain("| order");
  });
});
