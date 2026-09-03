import { describe, expect, it } from "vitest";

import {
  timelineStatusFromPartState,
  toolNameFromPart,
  toolStepsFromParts,
} from "./turn-timeline";

describe("toolNameFromPart", () => {
  it("reads façade names from tool-{name} parts", () => {
    expect(
      toolNameFromPart({
        type: "tool-orders_list_page",
        state: "input-available",
      }),
    ).toBe("orders_list_page");
  });

  it("reads dynamic-tool names", () => {
    expect(
      toolNameFromPart({
        type: "dynamic-tool",
        toolName: "orders_list_counts",
        state: "running",
      }),
    ).toBe("orders_list_counts");
  });

  it("skips text and data-confirmation", () => {
    expect(toolNameFromPart({ type: "text", text: "Hi" })).toBeNull();
    expect(
      toolNameFromPart({
        type: "data-confirmation",
        data: { status: "confirmation_required" },
      }),
    ).toBeNull();
  });
});

describe("timelineStatusFromPartState", () => {
  it("maps in-flight and result states", () => {
    expect(timelineStatusFromPartState("input-streaming")).toBe("queued");
    expect(timelineStatusFromPartState("input-available")).toBe("running");
    expect(timelineStatusFromPartState(undefined)).toBe("running");
    expect(timelineStatusFromPartState("output-available")).toBe("done");
    expect(timelineStatusFromPartState("output-error")).toBe("error");
  });
});

describe("toolStepsFromParts", () => {
  it("keeps in-flight façade tools and does not stringify output", () => {
    const output = {
      kind: "page.summary",
      items: [{ orderId: "o1", orderNumber: "1049" }],
    };
    const steps = toolStepsFromParts(
      [
        { type: "text", text: "" },
        {
          type: "tool-orders_list_page",
          toolCallId: "call-page",
          state: "input-available",
          output,
        },
        {
          type: "tool-orders_list_counts",
          toolCallId: "call-counts",
          state: "output-available",
          output: { kind: "aggregate", orderCount: 6 },
        },
      ],
      "a1",
    );
    expect(steps).toEqual([
      {
        id: "call-page",
        toolName: "orders_list_page",
        status: "running",
      },
      {
        id: "call-counts",
        toolName: "orders_list_counts",
        status: "done",
      },
    ]);
    expect(JSON.stringify(steps).includes("page.summary")).toBe(false);
    expect(JSON.stringify(steps).includes("orderNumber")).toBe(false);
  });
});
