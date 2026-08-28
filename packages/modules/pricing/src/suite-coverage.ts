import type { SuiteCoverageManifest } from "@showzy/core";

export const pricingSuiteCoverage = {
  isolation: [
    "pricing.createPriceList",
    "pricing.getPriceList",
    "pricing.listPriceLists",
    "pricing.resolveProductPrices",
    "pricing.updatePriceList",
  ],
  publicProjection: [],
  consumerIsolation: [],
  accountIsolation: [],
  shareIsolation: [],
  idempotency: ["pricing.createPriceList", "pricing.updatePriceList"],
  events: [],
  atomic: [],
} as const satisfies SuiteCoverageManifest;
