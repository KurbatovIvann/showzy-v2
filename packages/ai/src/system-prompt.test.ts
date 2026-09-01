import { describe, expect, it } from "vitest";

import { staffAssistantSystemPrompt } from "./system-prompt.js";

describe("staffAssistantSystemPrompt", () => {
  it("identifies the staff-panel channel and bilingual replies", () => {
    expect(staffAssistantSystemPrompt).toContain("Shozik");
    expect(staffAssistantSystemPrompt).toContain("staff-panel");
    expect(staffAssistantSystemPrompt).toContain("Ukrainian");
    expect(staffAssistantSystemPrompt).toContain("English");
  });

  it("states the model is not a principal and must use registry tools", () => {
    expect(staffAssistantSystemPrompt).toContain("not a principal");
    expect(staffAssistantSystemPrompt).toContain("tools provided");
    expect(staffAssistantSystemPrompt).toContain("Never call /rpc");
  });

  it("forbids QES keys, OTP, and cookies, and keeps confirmation as a human step", () => {
    expect(staffAssistantSystemPrompt).toContain("QES");
    expect(staffAssistantSystemPrompt).toContain("OTP");
    expect(staffAssistantSystemPrompt).toContain("cookies");
    expect(staffAssistantSystemPrompt).toContain("Human-in-the-loop");
    expect(staffAssistantSystemPrompt).toContain("Do not auto-confirm");
    expect(staffAssistantSystemPrompt).toContain("human step");
  });
});
