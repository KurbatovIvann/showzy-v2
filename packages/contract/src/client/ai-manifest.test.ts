import { defineActionContract } from "@showzy/core/contract";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  aiToolSourcesForPrincipal,
  deriveAiToolSources,
} from "./ai-manifest.js";

const readDefaults = {
  input: z.object({}),
  output: z.object({}),
  risk: "read" as const,
  requiresConfirmation: false,
  idempotent: false,
  emits: [] as const,
  atomicCalls: [] as const,
  atomicCallers: [] as const,
  audit: false,
  timeout: 5_000,
};

const staffExposed = defineActionContract({
  ...readDefaults,
  name: "sample.listForStaff",
  description: "Staff tool exposed to AI.",
  principal: "staff",
  transport: "client",
  aiExposure: "exposed",
  permissions: ["sample:view"],
});

const staffHidden = defineActionContract({
  ...readDefaults,
  name: "sample.listHidden",
  description: "Client action deliberately kept away from models.",
  principal: "staff",
  transport: "client",
  aiExposure: "internal",
  permissions: ["sample:view"],
});

const consumerExposed = defineActionContract({
  ...readDefaults,
  name: "sample.browse",
  description: "Consumer discovery tool.",
  principal: "consumer",
  transport: "client",
  aiExposure: "exposed",
  permissions: [],
});

const accountExposed = defineActionContract({
  ...readDefaults,
  name: "sample.listMine",
  description: "Account own-companies tool.",
  principal: "account",
  transport: "client",
  aiExposure: "exposed",
  permissions: [],
});

const systemInternal = defineActionContract({
  ...readDefaults,
  name: "sample.internalJob",
  description: "Internal system job — never an AI tool.",
  principal: "system",
  transport: "internal",
  systemScope: "tenant",
  aiExposure: "internal",
  permissions: [],
});

const all = [
  staffExposed,
  staffHidden,
  consumerExposed,
  accountExposed,
  systemInternal,
];

describe("AI manifest source derivation (contract.md §2)", () => {
  it("includes only transport: client + aiExposure: exposed descriptors", () => {
    expect(deriveAiToolSources(all)).toEqual([
      staffExposed,
      consumerExposed,
      accountExposed,
    ]);
  });

  it("filters by session principal — no company-scoped tools without an active company context", () => {
    expect(aiToolSourcesForPrincipal(all, "consumer")).toEqual([
      consumerExposed,
    ]);
    expect(aiToolSourcesForPrincipal(all, "account")).toEqual([accountExposed]);
    expect(aiToolSourcesForPrincipal(all, "staff")).toEqual([staffExposed]);
    expect(aiToolSourcesForPrincipal(all, "system")).toEqual([]);
  });
});
