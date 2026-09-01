import { generateText } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { describe, expect, it, vi } from "vitest";

import { createStaffLanguageModel } from "./language-model.js";

describe("staff language model", () => {
  it("constructs an Anthropic LanguageModel without touching the network", () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("network must not run"));

    const model = createStaffLanguageModel({
      apiKey: "sk-ant-test-not-a-real-key",
      model: "claude-sonnet-4-6",
    });

    expect(model).toBeDefined();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("runs generateText against MockLanguageModelV3 with no network", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("network must not run"));

    const model = new MockLanguageModelV3({
      doGenerate: {
        content: [{ type: "text", text: "ok" }],
        finishReason: { unified: "stop", raw: undefined },
        usage: {
          inputTokens: {
            total: 1,
            noCache: 1,
            cacheRead: 0,
            cacheWrite: 0,
          },
          outputTokens: { total: 1, text: 1, reasoning: 0 },
        },
        warnings: [],
      },
    });

    const result = await generateText({
      model,
      prompt: "ping",
    });

    expect(result.text).toBe("ok");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
