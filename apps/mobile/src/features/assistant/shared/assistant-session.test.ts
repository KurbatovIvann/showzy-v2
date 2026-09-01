import { describe, expect, it, vi } from "vitest";

import {
  ensureAssistantConversation,
  resetAssistantTenantSession,
  sendEnsuredAssistantMessage,
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
    const companyEpochRef = { current: 0 };
    const inputs: unknown[] = [];
    const id = await ensureAssistantConversation({
      conversationIdRef,
      companyEpochRef,
      epoch: 0,
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
    const companyEpochRef = { current: 0 };
    let created = 0;
    const id = await ensureAssistantConversation({
      conversationIdRef,
      companyEpochRef,
      epoch: 0,
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
    const companyEpochRef = { current: 0 };
    resetAssistantTenantSession({
      conversationIdRef,
      setMessages: () => undefined,
      resetConfirmation: () => undefined,
    });
    const inputs: unknown[] = [];
    const id = await ensureAssistantConversation({
      conversationIdRef,
      companyEpochRef,
      epoch: 0,
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

describe("sendEnsuredAssistantMessage", () => {
  it("drops a stale in-flight create after company switch and does not send", async () => {
    const conversationIdRef = { current: null as string | null };
    const companyEpochRef = { current: 0 };
    let resolveCreate: ((value: { readonly id: string }) => void) | undefined;
    let resolveStarted: (() => void) | undefined;
    const createStarted = new Promise<void>((resolve) => {
      resolveStarted = resolve;
    });
    const sendMessage = vi.fn(() => Promise.resolve());

    const sendPromise = sendEnsuredAssistantMessage({
      conversationIdRef,
      companyEpochRef,
      create: () => {
        resolveStarted?.();
        return new Promise<{ readonly id: string }>((resolve) => {
          resolveCreate = resolve;
        });
      },
      sendMessage,
      text: "hello from A",
    });

    await createStarted;
    companyEpochRef.current += 1;
    resetAssistantTenantSession({
      conversationIdRef,
      setMessages: () => undefined,
      resetConfirmation: () => undefined,
    });
    expect(resolveCreate).toBeDefined();
    resolveCreate?.({ id: conversationA });

    await expect(sendPromise).resolves.toBe("dropped");
    expect(conversationIdRef.current).toBeNull();
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
