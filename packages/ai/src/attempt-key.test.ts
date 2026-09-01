import { describe, expect, it } from "vitest";

import { attemptKey } from "./attempt-key.js";

const conversationId = "11111111-1111-4111-8111-111111111111";

describe("attemptKey", () => {
  it("builds message, tool, and turn keys as kind:conversationId:id", () => {
    expect(attemptKey("message", conversationId, "msg-1")).toBe(
      `message:${conversationId}:msg-1`,
    );
    expect(attemptKey("tool", conversationId, "call-a")).toBe(
      `tool:${conversationId}:call-a`,
    );
    expect(attemptKey("turn", conversationId, "req-1")).toBe(
      `turn:${conversationId}:req-1`,
    );
  });

  it("treats conversationId as a namespace so the same id differs across conversations", () => {
    const other = "22222222-2222-4222-8222-222222222222";
    expect(attemptKey("tool", conversationId, "call-a")).not.toBe(
      attemptKey("tool", other, "call-a"),
    );
  });
});
