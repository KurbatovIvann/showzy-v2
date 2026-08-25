import type { SuiteCoverageManifest } from "@showzy/core";

export const catalogSuiteCoverage = {
  isolation: [
    "catalog.getProductPricingFacts",
    "catalog.getProductOrderFacts",
    "catalog.createVariant",
    "catalog.updateVariant",
  ],
  publicProjection: [],
  consumerIsolation: [],
  accountIsolation: [],
  shareIsolation: [],
  idempotency: ["catalog.createVariant", "catalog.updateVariant"],
  events: [],
  atomic: [],
} as const satisfies SuiteCoverageManifest;
