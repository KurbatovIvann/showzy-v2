import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import * as ShowzyAi from "@showzy/ai";
import { ActionRegistry } from "@showzy/core";
import { pino } from "pino";
import { describe, expect, it, vi } from "vitest";

import { executeStaffAssistantChoiceResume } from "./assistant-choice.js";

const UUID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const here = dirname(fileURLToPath(import.meta.url));

describe("POST /assistant/choice unit", () => {
  it("does not import the gate, reply models, or confirmation GETDEL", () => {
    const src = readFileSync(join(here, "assistant-choice.ts"), "utf8");
    expect(src).not.toContain("classifyStaffAssistantTurn");
    expect(src).not.toContain("generateText");
    expect(src).not.toContain("streamText");
    expect(src).not.toContain("createStaffLanguageModel");
    expect(src).not.toMatch(/redis\.call\(\s*"GETDEL"/);
    const chat = readFileSync(join(here, "assistant-chat.ts"), "utf8");
    expect(chat).toContain("classifyStaffAssistantTurn");
    expect(chat).toContain("CONFIRMATION_CHALLENGE_HEADER");
    const redis = readFileSync(join(here, "../stores/redis.ts"), "utf8");
    expect(redis).toContain('redis.call("GETDEL"');
    expect(redis).toContain("CHOICE_CLAIM_LUA");
    const claimLua = redis.slice(
      redis.indexOf("const CHOICE_CLAIM_LUA"),
      redis.indexOf("const CHOICE_COMPLETE_LUA"),
    );
    expect(claimLua).not.toContain("GETDEL");
    const completeLua = redis.slice(
      redis.indexOf("const CHOICE_COMPLETE_LUA"),
      redis.indexOf("export function createRedisSecondaryStorage"),
    );
    expect(completeLua).not.toContain("GETDEL");
  });

  it("returns 401 before claiming Redis or constructing models", async () => {
    const classify = vi.spyOn(ShowzyAi, "classifyStaffAssistantTurn");
    const stream = vi.spyOn(ShowzyAi, "streamStaffAssistantChat");
    const choiceStore = {
      open: vi.fn(),
      claim: vi.fn(),
      peek: vi.fn(),
      complete: vi.fn(),
    };
    const response = await executeStaffAssistantChoiceResume({
      request: new Request("http://localhost:3000/assistant/choice", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversationId: UUID,
          choiceId: UUID,
          optionId: UUID,
        }),
      }),
      requestId: UUID,
      clientIp: "127.0.0.1",
      registry: new ActionRegistry(),
      pipeline: { logger: pino({ enabled: false }) } as never,
      getSession: () => Promise.resolve(null),
      choiceStore,
    });
    expect(response.status).toBe(401);
    expect(choiceStore.claim).not.toHaveBeenCalled();
    expect(choiceStore.peek).not.toHaveBeenCalled();
    expect(classify).not.toHaveBeenCalled();
    expect(stream).not.toHaveBeenCalled();
    classify.mockRestore();
    stream.mockRestore();
  });
});
