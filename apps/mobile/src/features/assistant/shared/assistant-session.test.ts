import { describe, expect, it } from "vitest";

import {
  ensureAssistantConversation,
  resetAssistantTenantSession,
} from "./assistant-session";

const conversationA = "11111111-1111-4111-8111-111111111111";
const conversationB = "55555555-5555-4555-8555-555555555555";

describe("resetAssistantTenantSession", () => {
  it("clears conversation id, messages, and confirmation on company change", () => {
    const conversationIdRef = { current: conversationA };
    let messages: readonly { id: string }[] = [{ id: "stale" }];
    let confirmationReset = false;
    resetAssistantTenantSession({
      conversationIdRef,
      setMessages: (next) => {
        messages = next;
      },
      resetConfirmation: () => {
        confirmationReset = true;
      },
    });
    expect(conversationIdRef.current).toBeNull();
    expect(messages).toEqual([]);
    expect(confirmationReset).toBe(true);
  });
});

describe("ensureAssistantConversation", () => {
  it("creates with empty input and does not send companyId", async () => {
    const conversationIdRef = { current: null as string | null };
    const inputs: unknown[] = [];
    const id = await ensureAssistantConversation({
      conversationIdRef,
      create: () => {
        const input = {};
        inputs.push(input);
        return Promise.resolve({ id: conversationB });
      },
    });
    expect(id).toBe(conversationB);
    expect(conversationIdRef.current).toBe(conversationB);
    expect(inputs).toEqual([{}]);
    expect(JSON.stringify(inputs[0])).not.toContain("companyId");
  });

  it("reuses the existing conversation id without creating", async () => {
    const conversationIdRef = { current: conversationA };
    let created = 0;
    const id = await ensureAssistantConversation({
      conversationIdRef,
      create: () => {
        created += 1;
        return Promise.resolve({ id: conversationB });
      },
    });
    expect(id).toBe(conversationA);
    expect(created).toBe(0);
  });

  it("creates a new conversation after a company-switch reset", async () => {
    const conversationIdRef = { current: conversationA };
    resetAssistantTenantSession({
      conversationIdRef,
      setMessages: () => undefined,
      resetConfirmation: () => undefined,
    });
    const inputs: unknown[] = [];
    const id = await ensureAssistantConversation({
      conversationIdRef,
      create: () => {
        inputs.push({});
        return Promise.resolve({ id: conversationB });
      },
    });
    expect(id).toBe(conversationB);
    expect(conversationIdRef.current).toBe(conversationB);
    expect(inputs).toEqual([{}]);
    expect(JSON.stringify(inputs[0])).not.toContain("companyId");
  });
});
