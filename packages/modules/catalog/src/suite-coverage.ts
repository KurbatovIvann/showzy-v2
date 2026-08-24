import type { SuiteCoverageManifest } from "@showzy/core";

export const catalogSuiteCoverage = {
  isolation: [
    "catalog.getProduct",
    "catalog.getProductPricingFacts",
    "catalog.getProductOrderFacts",
    "catalog.listProducts",
  ],
  publicProjection: [],
  consumerIsolation: [],
  accountIsolation: [],
  shareIsolation: [],
  idempotency: [],
  events: [],
  atomic: [],
} as const satisfies SuiteCoverageManifest;
