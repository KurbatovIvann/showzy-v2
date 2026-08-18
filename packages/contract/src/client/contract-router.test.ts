import { isContractProcedure } from "@orpc/contract";
import { defineActionContract } from "@showzy/core/contract";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  buildContractRouter,
  ContractCompositionError,
} from "./contract-router.js";

const readDefaults = {
  aiExposure: "internal" as const,
  risk: "read" as const,
  requiresConfirmation: false,
  idempotent: false,
  emits: [] as const,
  atomicCalls: [] as const,
  atomicCallers: [] as const,
  audit: false,
  timeout: 5_000,
};

const listThings = defineActionContract({
  ...readDefaults,
  name: "sample.listThings",
  description: "List sample things for the active company.",
  principal: "staff",
  transport: "client",
  input: z.object({ limit: z.number().int().min(1) }),
  output: z.object({ items: z.array(z.string()) }),
  permissions: ["sample:view"],
});

const internalJob = defineActionContract({
  ...readDefaults,
  name: "sample.internalJob",
  description: "Internal system job — never routable.",
  principal: "system",
  transport: "internal",
  systemScope: "tenant",
  input: z.object({}),
  output: z.object({ done: z.boolean() }),
  permissions: [],
});

describe("buildContractRouter", () => {
  it("builds one contract procedure per client descriptor", () => {
    const router = buildContractRouter({ sample: { listThings } });
    expect(isContractProcedure(router.sample.listThings)).toBe(true);
  });

  it("rejects non-client transports — internal/system actions have no routable endpoint", () => {
    expect(() => buildContractRouter({ sample: { internalJob } })).toThrow(
      ContractCompositionError,
    );
    expect(() => buildContractRouter({ sample: { internalJob } })).toThrow(
      /transport "internal"/,
    );
  });

  it("rejects record keys that do not mirror the action name", () => {
    expect(() =>
      buildContractRouter({ sample: { things: listThings } }),
    ).toThrow(/bound to descriptor "sample.listThings"/);
    expect(() => buildContractRouter({ catalog: { listThings } })).toThrow(
      /catalog.listThings/,
    );
  });

  it("collects every problem instead of stopping at the first", () => {
    try {
      buildContractRouter({
        sample: { internalJob, wrongKey: listThings },
      });
      expect.unreachable("composition must fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ContractCompositionError);
      expect((error as ContractCompositionError).problems).toHaveLength(2);
    }
  });
});
