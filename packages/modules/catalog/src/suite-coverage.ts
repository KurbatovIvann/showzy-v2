import type { SuiteCoverageManifest } from "@showzy/core";

export const catalogSuiteCoverage = {
  isolation: ["catalog.getProductPricingFacts", "catalog.getProductOrderFacts"],
  publicProjection: [],
  consumerIsolation: [],
  accountIsolation: [],
  shareIsolation: [],
  idempotency: [],
  events: [],
  atomic: [],
} as const satisfies SuiteCoverageManifest;
