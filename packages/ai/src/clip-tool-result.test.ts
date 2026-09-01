import { describe, expect, it } from "vitest";

import {
  clipStaffAssistantToolResult,
  STAFF_ASSISTANT_CLIPPED_STATUS,
  STAFF_ASSISTANT_CLIP_ARRAY_MAX,
  STAFF_ASSISTANT_CLIP_JSON_MAX,
} from "./clip-tool-result.js";
import { STAFF_ASSISTANT_CONFIRMATION_STATUS } from "./confirmation.js";
import { extractUuidResultIds } from "./staff-assistant-stream.js";

const customerId = "11111111-1111-4111-8111-111111111111";
const challengeId = "22222222-2222-4222-8222-222222222222";

function rowId(index: number): string {
  return `33333333-3333-4333-8333-${index.toString(16).padStart(12, "0")}`;
}

describe("clipStaffAssistantToolResult", () => {
  it("passes confirmation payloads through unchanged", () => {
    const confirmation = {
      status: STAFF_ASSISTANT_CONFIRMATION_STATUS,
      challengeId,
      summary: "Delete this archived customer.",
      expiresAt: "2026-09-01T12:00:00.000Z",
      actionName: "customers.deleteCustomer",
      toolCallId: "call-delete",
    };
    expect(clipStaffAssistantToolResult(confirmation)).toBe(confirmation);
  });

  it("passes typed error objects through unchanged", () => {
    const error = {
      status: "error",
      code: "NOT_FOUND",
      message: "Customer not found.",
    };
    expect(clipStaffAssistantToolResult(error)).toBe(error);
  });

  it("does not clip a small create-style write result", () => {
    const created = { customerId };
    expect(clipStaffAssistantToolResult(created)).toBe(created);
    expect(extractUuidResultIds({ customerId })).toEqual([customerId]);
    expect(extractUuidResultIds({ id: customerId })).toEqual([customerId]);
  });

  it("clips list-shaped items to the array cap and reports omitted count", () => {
    const items = Array.from(
      { length: STAFF_ASSISTANT_CLIP_ARRAY_MAX + 15 },
      (_, index) => ({
        orderId: rowId(index),
      }),
    );
    const clipped = clipStaffAssistantToolResult({
      items,
      nextCursor: null,
    });
    expect(clipped).toEqual({
      status: STAFF_ASSISTANT_CLIPPED_STATUS,
      preview: {
        items: items.slice(0, STAFF_ASSISTANT_CLIP_ARRAY_MAX),
        nextCursor: null,
      },
      omitted: 15,
    });
  });

  it("clips oversized JSON that has no long array", () => {
    const body = "x".repeat(STAFF_ASSISTANT_CLIP_JSON_MAX + 80);
    expect(clipStaffAssistantToolResult({ body })).toEqual({
      status: STAFF_ASSISTANT_CLIPPED_STATUS,
      preview: { truncated: true },
      omitted: 1,
    });
  });
});
