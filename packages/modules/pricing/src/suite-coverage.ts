import type { SuiteCoverageManifest } from "@showzy/core";

export const pricingSuiteCoverage = {
  isolation: ["pricing.listPriceLists", "pricing.resolveProductPrices"],
  publicProjection: [],
  consumerIsolation: [],
  accountIsolation: [],
  shareIsolation: [],
  idempotency: [],
  events: [],
  atomic: [],
} as const satisfies SuiteCoverageManifest;
