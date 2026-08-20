import type { SuiteCoverageManifest } from "@showzy/core";

export const catalogSuiteCoverage = {
  isolation: ["catalog.getProductPricingFacts"],
  publicProjection: [],
  consumerIsolation: [],
  accountIsolation: [],
  shareIsolation: [],
  idempotency: [],
  events: [],
  atomic: [],
} as const satisfies SuiteCoverageManifest;
