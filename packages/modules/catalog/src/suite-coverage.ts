import type { SuiteCoverageManifest } from "@showzy/core";

export const catalogSuiteCoverage = {
  isolation: [
    "catalog.createProduct",
    "catalog.getProduct",
    "catalog.getProductOrderFacts",
    "catalog.getProductPricingFacts",
    "catalog.listProducts",
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
