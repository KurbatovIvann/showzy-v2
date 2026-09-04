import { describe, expect, it } from "vitest";

import {
  timelineStatusFromPartState,
  toolNameFromPart,
  toolStepsFromParts,
} from "./turn-timeline";

const hitlOutput = {
  status: "confirmation_required" as const,
  challengeId: "22222222-2222-4222-8222-222222222222",
  summary: "Delete this archived customer.",
  expiresAt: "2026-09-01T12:00:00.000Z",
  actionName: "customers.deleteCustomer",
  toolCallId: "call-delete",
};

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
        type: "data-choice",
        data: { status: "needs_choice" },
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

  it("does not mark HITL-paused output-available as done", () => {
    expect(timelineStatusFromPartState("output-available", hitlOutput)).toBe(
      "running",
    );
  });

  it("keeps needs_choice output-available in-flight, not done", () => {
    expect(
      timelineStatusFromPartState("output-available", {
        status: "needs_choice",
        challengeId: hitlOutput.challengeId,
        reason: "variant_required",
        productName: "Macarons",
        options: [{ id: hitlOutput.challengeId, label: "Lemon" }],
        optionsTruncated: false,
      }),
    ).toBe("running");
  });

  it("marks façade { status: error } output-available as error, not done", () => {
    expect(
      timelineStatusFromPartState("output-available", {
        status: "error",
        code: "INTERNAL",
        message: "Tool failed",
      }),
    ).toBe("error");
  });

  it("marks successful page and aggregate output-available as done", () => {
    expect(
      timelineStatusFromPartState("output-available", {
        kind: "page",
        items: [{ orderId: "o1" }],
      }),
    ).toBe("done");
    expect(
      timelineStatusFromPartState("output-available", {
        kind: "aggregate",
        orderCount: 6,
      }),
    ).toBe("done");
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

  it("keeps façade error output-available as error and does not stringify output", () => {
    const output = {
      status: "error" as const,
      code: "PERMISSION_DENIED",
      message: "Staff cannot list these orders",
    };
    const steps = toolStepsFromParts(
      [
        {
          type: "tool-orders_list_page",
          toolCallId: "call-page",
          state: "output-available",
          output,
        },
      ],
      "a1",
    );
    expect(steps).toEqual([
      {
        id: "call-page",
        toolName: "orders_list_page",
        status: "error",
      },
    ]);
    expect(JSON.stringify(steps).includes("PERMISSION_DENIED")).toBe(false);
    expect(JSON.stringify(steps).includes("Staff cannot list")).toBe(false);
  });

  it("keeps HITL-paused output-available in-flight, not done", () => {
    const steps = toolStepsFromParts(
      [
        {
          type: "tool-customers.deleteCustomer",
          toolCallId: "call-delete",
          state: "output-available",
          output: hitlOutput,
        },
      ],
      "a1",
    );
    expect(steps).toEqual([
      {
        id: "call-delete",
        toolName: "customers.deleteCustomer",
        status: "running",
      },
    ]);
    expect(JSON.stringify(steps).includes("confirmation_required")).toBe(false);
    expect(JSON.stringify(steps).includes("challengeId")).toBe(false);
  });

  it("skips data-choice parts and keeps needs_choice tool output running", () => {
    const choiceOutput = {
      status: "needs_choice" as const,
      challengeId: hitlOutput.challengeId,
      reason: "variant_required" as const,
      productName: "Macarons",
      options: [{ id: hitlOutput.challengeId, label: "Lemon" }],
      optionsTruncated: false,
    };
    const steps = toolStepsFromParts(
      [
        { type: "data-choice", data: choiceOutput },
        {
          type: "tool-orders_create",
          toolCallId: "call-create",
          state: "output-available",
          output: choiceOutput,
        },
      ],
      "a1",
    );
    expect(steps).toEqual([
      {
        id: "call-create",
        toolName: "orders_create",
        status: "running",
      },
    ]);
  });

  it("omits Anthropic synthetic json structured-output tools", () => {
    const steps = toolStepsFromParts(
      [
        {
          type: "tool-orders_list_page",
          toolCallId: "call-page",
          state: "output-available",
          output: { kind: "page.summary", items: [] },
        },
        {
          type: "tool-json",
          toolName: "json",
          toolCallId: "call-json",
          state: "output-available",
          output: { spoken: "Four orders." },
        },
        {
          type: "dynamic-tool",
          toolName: "json",
          toolCallId: "call-json-2",
          state: "running",
        },
      ],
      "a1",
    );
    expect(steps).toEqual([
      {
        id: "call-page",
        toolName: "orders_list_page",
        status: "done",
      },
    ]);
    expect(JSON.stringify(steps).includes("json")).toBe(false);
    expect(JSON.stringify(steps).includes("spoken")).toBe(false);
  });

  it("omits dismissed HITL tools and keeps a successful non-HITL result", () => {
    const steps = toolStepsFromParts(
      [
        {
          type: "tool-orders_list_counts",
          toolCallId: "call-counts",
          state: "output-available",
          output: { kind: "aggregate", orderCount: 6 },
        },
        { type: "data-confirmation", data: hitlOutput },
        {
          type: "tool-customers.deleteCustomer",
          toolCallId: "call-delete",
          state: "output-available",
          output: hitlOutput,
        },
      ],
      "a1",
      new Set([hitlOutput.challengeId]),
    );
    expect(steps).toEqual([
      {
        id: "call-counts",
        toolName: "orders_list_counts",
        status: "done",
      },
    ]);
  });
});
