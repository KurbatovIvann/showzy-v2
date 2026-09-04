import { describe, expect, it, vi } from "vitest";

import {
  classifyStaffAssistantTurn,
  STAFF_ASSISTANT_GATE_SYSTEM,
  STAFF_ASSISTANT_JOB_INTENT_TOOLS,
  staffAssistantGateOutputSchema,
  staffAssistantGateToolPolicy,
} from "./gate.js";
import { STAFF_ASSISTANT_PRODUCT_GLOSSARY } from "./product-glossary.js";
import {
  MockLanguageModelV3,
  mockGenerateObjectResult,
  mockStaffAssistantGateGenerate,
} from "./test.js";
import { EMPTY_STAFF_ASSISTANT_TURN_USAGE } from "./usage.js";

const mockGateUsage = {
  inputTokens: 1,
  outputTokens: 1,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
};

describe("STAFF_ASSISTANT_GATE_SYSTEM", () => {
  it("shares the product glossary and names T3 modes, intents, and examples", () => {
    expect(STAFF_ASSISTANT_GATE_SYSTEM).toContain(
      STAFF_ASSISTANT_PRODUCT_GLOSSARY,
    );
    expect(STAFF_ASSISTANT_GATE_SYSTEM).toContain("show last 3 orders");
    expect(STAFF_ASSISTANT_GATE_SYSTEM).toContain("orders_page");
    expect(STAFF_ASSISTANT_GATE_SYSTEM).toContain("how many orders today");
    expect(STAFF_ASSISTANT_GATE_SYSTEM).toContain("orders_counts");
    expect(STAFF_ASSISTANT_GATE_SYSTEM).toContain("create an order for");
    expect(STAFF_ASSISTANT_GATE_SYSTEM).toContain("orders_create");
    expect(STAFF_ASSISTANT_GATE_SYSTEM).toContain("hello");
    expect(STAFF_ASSISTANT_GATE_SYSTEM).toContain("chitchat");
    expect(STAFF_ASSISTANT_GATE_SYSTEM).toContain(
      "can you help with price lists?",
    );
    expect(STAFF_ASSISTANT_GATE_SYSTEM).toContain("capability");
    expect(STAFF_ASSISTANT_GATE_SYSTEM).toContain(
      "Чи можеш ти створювати прайс-листи?",
    );
    expect(STAFF_ASSISTANT_GATE_SYSTEM).toContain(
      "А з чим ти можеш допомогти ще?",
    );
    expect(STAFF_ASSISTANT_GATE_SYSTEM).toContain("mixed-domain");
    expect(STAFF_ASSISTANT_GATE_SYSTEM).toContain("intent other");
    expect(STAFF_ASSISTANT_GATE_SYSTEM).toContain(
      "If you are unsure, mode job, intent other, confidence low",
    );
    expect(STAFF_ASSISTANT_GATE_SYSTEM).not.toContain("operational true");
    expect(STAFF_ASSISTANT_GATE_SYSTEM).not.toContain(
      "what you can do, or anything off-topic",
    );
  });
});

describe("staffAssistantGateOutputSchema", () => {
  it("parses classifier examples for page, counts, create, chitchat, and capability", () => {
    expect(
      staffAssistantGateOutputSchema.parse({
        mode: "job",
        intent: "orders_page",
        confidence: "high",
      }),
    ).toEqual({
      mode: "job",
      intent: "orders_page",
      confidence: "high",
    });
    expect(
      staffAssistantGateOutputSchema.parse({
        mode: "job",
        intent: "orders_counts",
        confidence: "high",
      }).intent,
    ).toBe("orders_counts");
    expect(
      staffAssistantGateOutputSchema.parse({
        mode: "job",
        intent: "orders_create",
        confidence: "high",
      }).intent,
    ).toBe("orders_create");
    expect(
      staffAssistantGateOutputSchema.parse({
        mode: "chitchat",
        confidence: "high",
      }),
    ).toEqual({ mode: "chitchat", confidence: "high" });
    expect(
      staffAssistantGateOutputSchema.parse({
        mode: "capability",
        confidence: "high",
      }).mode,
    ).toBe("capability");
  });

  it("rejects a job without intent", () => {
    expect(
      staffAssistantGateOutputSchema.safeParse({
        mode: "job",
        confidence: "high",
      }).success,
    ).toBe(false);
  });
});

describe("staffAssistantGateToolPolicy", () => {
  it("narrows only a high-confidence single job intent to one forced tool", () => {
    expect(
      staffAssistantGateToolPolicy({
        mode: "job",
        intent: "orders_page",
        confidence: "high",
      }),
    ).toEqual({
      kind: "forced",
      toolName: STAFF_ASSISTANT_JOB_INTENT_TOOLS.orders_page,
    });
    expect(
      staffAssistantGateToolPolicy({
        mode: "job",
        intent: "orders_counts",
        confidence: "high",
      }),
    ).toEqual({
      kind: "forced",
      toolName: STAFF_ASSISTANT_JOB_INTENT_TOOLS.orders_counts,
    });
    expect(
      staffAssistantGateToolPolicy({
        mode: "job",
        intent: "orders_create",
        confidence: "high",
      }),
    ).toEqual({
      kind: "forced",
      toolName: STAFF_ASSISTANT_JOB_INTENT_TOOLS.orders_create,
    });
  });

  it("returns other/full for low confidence, mixed other, and capability", () => {
    expect(
      staffAssistantGateToolPolicy({
        mode: "job",
        intent: "orders_page",
        confidence: "low",
      }),
    ).toEqual({ kind: "full" });
    expect(
      staffAssistantGateToolPolicy({
        mode: "job",
        intent: "other",
        confidence: "high",
      }),
    ).toEqual({ kind: "full" });
    expect(
      staffAssistantGateToolPolicy({
        mode: "capability",
        confidence: "high",
      }),
    ).toEqual({ kind: "full" });
    expect(
      staffAssistantGateToolPolicy({
        mode: "chitchat",
        confidence: "low",
      }),
    ).toEqual({ kind: "full" });
  });

  it("attaches no tools for high-confidence chitchat", () => {
    expect(
      staffAssistantGateToolPolicy({
        mode: "chitchat",
        confidence: "high",
      }),
    ).toEqual({ kind: "none" });
  });
});

describe("classifyStaffAssistantTurn", () => {
  it("returns chitchat without calling tools", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("network must not run"));
    const model = new MockLanguageModelV3({
      doGenerate: mockStaffAssistantGateGenerate({
        mode: "chitchat",
        confidence: "high",
      }),
    });
    await expect(
      classifyStaffAssistantTurn({
        model,
        lastUserText: "hello",
      }),
    ).resolves.toEqual({
      mode: "chitchat",
      confidence: "high",
      usage: mockGateUsage,
    });
    expect(model.doGenerateCalls.length).toBe(1);
    expect(model.doGenerateCalls[0]?.tools).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("returns high-confidence job intents for page, counts, and create examples", async () => {
    const page = new MockLanguageModelV3({
      doGenerate: mockStaffAssistantGateGenerate({
        mode: "job",
        intent: "orders_page",
        confidence: "high",
      }),
    });
    await expect(
      classifyStaffAssistantTurn({
        model: page,
        lastUserText: "show last 3 orders",
      }),
    ).resolves.toEqual({
      mode: "job",
      intent: "orders_page",
      confidence: "high",
      usage: mockGateUsage,
    });

    const counts = new MockLanguageModelV3({
      doGenerate: mockStaffAssistantGateGenerate({
        mode: "job",
        intent: "orders_counts",
        confidence: "high",
      }),
    });
    await expect(
      classifyStaffAssistantTurn({
        model: counts,
        lastUserText: "how many orders today",
      }),
    ).resolves.toEqual({
      mode: "job",
      intent: "orders_counts",
      confidence: "high",
      usage: mockGateUsage,
    });

    const create = new MockLanguageModelV3({
      doGenerate: mockStaffAssistantGateGenerate({
        mode: "job",
        intent: "orders_create",
        confidence: "high",
      }),
    });
    await expect(
      classifyStaffAssistantTurn({
        model: create,
        lastUserText: "create an order for Леха",
      }),
    ).resolves.toEqual({
      mode: "job",
      intent: "orders_create",
      confidence: "high",
      usage: mockGateUsage,
    });
  });

  it("returns capability for a price-list help question", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: mockStaffAssistantGateGenerate({
        mode: "capability",
        confidence: "high",
      }),
    });
    await expect(
      classifyStaffAssistantTurn({
        model,
        lastUserText: "can you help with price lists?",
      }),
    ).resolves.toEqual({
      mode: "capability",
      confidence: "high",
      usage: mockGateUsage,
    });
  });

  it("skips the model and fail-opens on empty last user text", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: mockStaffAssistantGateGenerate({
        mode: "chitchat",
        confidence: "high",
      }),
    });
    await expect(
      classifyStaffAssistantTurn({ model, lastUserText: "   " }),
    ).resolves.toEqual({
      mode: "job",
      intent: "other",
      confidence: "low",
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
      mode: "job",
      intent: "other",
      confidence: "low",
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
      mode: "job",
      intent: "other",
      confidence: "low",
      usage: EMPTY_STAFF_ASSISTANT_TURN_USAGE,
    });
  });
});
