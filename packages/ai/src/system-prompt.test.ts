import { describe, expect, it } from "vitest";

import { STAFF_ASSISTANT_CACHE_CONTROL } from "./anthropic-options.js";
import {
  staffAssistantSystemMessage,
  staffAssistantSystemMessages,
  staffAssistantSystemPrompt,
} from "./system-prompt.js";

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

  it("stays in the company and does not print internal wire keys", () => {
    expect(staffAssistantSystemPrompt).toContain("this Shozee company");
    expect(staffAssistantSystemPrompt).toContain("short refusal");
    expect(staffAssistantSystemPrompt).toContain("supplierSigned");
    expect(staffAssistantSystemPrompt).toContain("userId");
    expect(staffAssistantSystemPrompt).toContain("product language");
  });

  it("marks the system message with a 5-minute ephemeral cache breakpoint", () => {
    const message = staffAssistantSystemMessage();
    expect(message.role).toBe("system");
    expect(message.content).toBe(staffAssistantSystemPrompt);
    expect(message.providerOptions).toEqual({
      anthropic: { cacheControl: STAFF_ASSISTANT_CACHE_CONTROL },
    });
    expect(STAFF_ASSISTANT_CACHE_CONTROL).toEqual({
      type: "ephemeral",
      ttl: "5m",
    });
  });

  it("leaves the cached prefix unchanged and does not cache the working-set addendum", () => {
    const cached = staffAssistantSystemMessage();
    const withAddendum = staffAssistantSystemMessages(
      "Working set from earlier tool runs in this conversation (ids only; not live record state):\ncatalog.listProducts: aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );
    expect(withAddendum[0]).toEqual(cached);
    expect(withAddendum[0]?.content).toBe(staffAssistantSystemPrompt);
    expect(withAddendum[1]?.providerOptions).toBeUndefined();
    expect(withAddendum[1]?.content).toContain("catalog.listProducts");
  });
});
