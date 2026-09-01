import { describe, expect, it } from "vitest";

import { staffAssistantShouldSkipOperationalGate } from "./sticky-session.js";

describe("staffAssistantShouldSkipOperationalGate", () => {
  it("skips once the conversation has already run tools", () => {
    expect(
      staffAssistantShouldSkipOperationalGate({ toolRunCount: 1 }),
    ).toBe(true);
    expect(
      staffAssistantShouldSkipOperationalGate({ toolRunCount: 4 }),
    ).toBe(true);
  });

  it("does not skip when no tool has run, regardless of the last user text", () => {
    expect(
      staffAssistantShouldSkipOperationalGate({ toolRunCount: 0 }),
    ).toBe(false);
  });
});
