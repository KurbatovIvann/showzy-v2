import type { SuiteCoverageManifest } from "@showzy/core";

export const catalogSuiteCoverage = {
  isolation: [
    "catalog.getProductPricingFacts",
    "catalog.getProductOrderFacts",
    "catalog.createProduct",
    "catalog.updateProduct",
    "catalog.createVariant",
    "catalog.updateVariant",
    "catalog.archiveProduct",
    "catalog.restoreProduct",
    "catalog.archiveVariant",
    "catalog.restoreVariant",
  ],
  publicProjection: [],
  consumerIsolation: [],
  accountIsolation: [],
  shareIsolation: [],
  idempotency: [
    "catalog.createProduct",
    "catalog.updateProduct",
    "catalog.createVariant",
    "catalog.updateVariant",
    "catalog.archiveProduct",
    "catalog.restoreProduct",
    "catalog.archiveVariant",
    "catalog.restoreVariant",
  ],
  events: [],
  atomic: [],
} as const satisfies SuiteCoverageManifest;
