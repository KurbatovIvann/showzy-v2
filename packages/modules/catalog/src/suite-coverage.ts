import type { SuiteCoverageManifest } from "@showzy/core";

export const catalogSuiteCoverage = {
  isolation: [
    "catalog.createProduct",
    "catalog.createVariant",
    "catalog.getProduct",
    "catalog.getProductOrderFacts",
    "catalog.getProductPricingFacts",
    "catalog.listProducts",
    "catalog.updateProduct",
    "catalog.updateVariant",
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
  ],
  events: [],
  atomic: [],
} as const satisfies SuiteCoverageManifest;
