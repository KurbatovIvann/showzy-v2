import { describe, expect, it } from "vitest";

import {
  isStaffAssistantContinuationAck,
  normalizeStaffAssistantAck,
  staffAssistantShouldSkipOperationalGate,
} from "./continuation-ack.js";

describe("isStaffAssistantContinuationAck", () => {
  it("accepts short Ukrainian and English confirmations", () => {
    expect(isStaffAssistantContinuationAck("Все вірно")).toBe(true);
    expect(isStaffAssistantContinuationAck("  ТАК! ")).toBe(true);
    expect(isStaffAssistantContinuationAck("ок.")).toBe(true);
    expect(isStaffAssistantContinuationAck("давай")).toBe(true);
    expect(isStaffAssistantContinuationAck("yes")).toBe(true);
    expect(isStaffAssistantContinuationAck("do it")).toBe(true);
  });

  it("rejects weather, capability questions, and mixed follow-ups", () => {
    expect(isStaffAssistantContinuationAck("Яка погода в Києві?")).toBe(false);
    expect(isStaffAssistantContinuationAck("так, яка погода")).toBe(false);
    expect(isStaffAssistantContinuationAck("А з чим ти можеш допомогти ще?")).toBe(
      false,
    );
    expect(isStaffAssistantContinuationAck("")).toBe(false);
  });
});

describe("staffAssistantShouldSkipOperationalGate", () => {
  it("skips only when a short ack follows a conversation that already ran tools", () => {
    expect(
      staffAssistantShouldSkipOperationalGate({
        lastUserText: "Все вірно",
        toolRunCount: 1,
      }),
    ).toBe(true);
    expect(
      staffAssistantShouldSkipOperationalGate({
        lastUserText: "Все вірно",
        toolRunCount: 0,
      }),
    ).toBe(false);
    expect(
      staffAssistantShouldSkipOperationalGate({
        lastUserText: "What's the weather in Kyiv?",
        toolRunCount: 4,
      }),
    ).toBe(false);
  });
});

describe("normalizeStaffAssistantAck", () => {
  it("strips wrapping quotes and trailing punctuation", () => {
    expect(normalizeStaffAssistantAck("«Так»")).toBe("так");
    expect(normalizeStaffAssistantAck("все вірно...")).toBe("все вірно");
  });
});
