import { describe, expect, it, vi } from "vitest";

import { classifyStaffAssistantTurn } from "./gate.js";
import {
  MockLanguageModelV3,
  mockGenerateObjectResult,
  mockOperationalGateGenerate,
} from "./test.js";
import { EMPTY_STAFF_ASSISTANT_TURN_USAGE } from "./usage.js";

const mockGateUsage = {
  inputTokens: 1,
  outputTokens: 1,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
};

describe("classifyStaffAssistantTurn", () => {
  it("returns operational false without calling tools", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("network must not run"));
    const model = new MockLanguageModelV3({
      doGenerate: mockOperationalGateGenerate(false),
    });
    await expect(
      classifyStaffAssistantTurn({
        model,
        lastUserText: "What's the weather in Kyiv?",
      }),
    ).resolves.toEqual({ operational: false, usage: mockGateUsage });
    expect(model.doGenerateCalls.length).toBe(1);
    expect(model.doGenerateCalls[0]?.tools).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("returns operational true for company work", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: mockOperationalGateGenerate(true),
    });
    await expect(
      classifyStaffAssistantTurn({
        model,
        lastUserText: "Create a customer named Леха",
      }),
    ).resolves.toEqual({ operational: true, usage: mockGateUsage });
  });

  it("skips the model and fail-opens on empty last user text", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: mockOperationalGateGenerate(false),
    });
    await expect(
      classifyStaffAssistantTurn({ model, lastUserText: "   " }),
    ).resolves.toEqual({
      operational: true,
      usage: EMPTY_STAFF_ASSISTANT_TURN_USAGE,
    });
    expect(model.doGenerateCalls).toHaveLength(0);
  });

  it("fail-opens when classify throws or returns invalid JSON", async () => {
    const throwing = new MockLanguageModelV3({
      doGenerate: () => Promise.reject(new Error("gate down")),
    });
    await expect(
      classifyStaffAssistantTurn({
        model: throwing,
        lastUserText: "List orders",
      }),
    ).resolves.toEqual({
      operational: true,
      usage: EMPTY_STAFF_ASSISTANT_TURN_USAGE,
    });

    const invalid = new MockLanguageModelV3({
      doGenerate: mockGenerateObjectResult("not-json"),
    });
    await expect(
      classifyStaffAssistantTurn({
        model: invalid,
        lastUserText: "List orders",
      }),
    ).resolves.toEqual({
      operational: true,
      usage: EMPTY_STAFF_ASSISTANT_TURN_USAGE,
    });
  });
});
