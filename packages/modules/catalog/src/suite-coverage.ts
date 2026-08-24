import type { SuiteCoverageManifest } from "@showzy/core";

export const catalogSuiteCoverage = {
  isolation: [
    "catalog.getProductPricingFacts",
    "catalog.getProductOrderFacts",
    "catalog.createProduct",
    "catalog.updateProduct",
  ],
  publicProjection: [],
  consumerIsolation: [],
  accountIsolation: [],
  shareIsolation: [],
  idempotency: ["catalog.createProduct", "catalog.updateProduct"],
  events: [],
  atomic: [],
} as const satisfies SuiteCoverageManifest;
