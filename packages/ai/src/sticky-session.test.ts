import { describe, expect, it } from "vitest";

import { staffAssistantShouldSkipIntentGate } from "./sticky-session.js";

describe("staffAssistantShouldSkipIntentGate", () => {
  it("skips confirmation and choice resumes", () => {
    expect(
      staffAssistantShouldSkipIntentGate({ confirmationResume: true }),
    ).toBe(true);
    expect(staffAssistantShouldSkipIntentGate({ choiceResume: true })).toBe(
      true,
    );
  });

  it("still routes a second normal user turn after prior tool runs", () => {
    expect(staffAssistantShouldSkipIntentGate({})).toBe(false);
    expect(
      staffAssistantShouldSkipIntentGate({
        confirmationResume: false,
        choiceResume: false,
      }),
    ).toBe(false);
  });
});
