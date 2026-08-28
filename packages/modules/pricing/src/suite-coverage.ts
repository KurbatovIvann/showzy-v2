import type { SuiteCoverageManifest } from "@showzy/core";

export const pricingSuiteCoverage = {
  isolation: [
    "pricing.createPriceList",
    "pricing.getPriceList",
    "pricing.listPriceListEntries",
    "pricing.listPriceLists",
    "pricing.removePriceListEntries",
    "pricing.resolveProductPrices",
    "pricing.setPriceListEntries",
    "pricing.updatePriceList",
  ],
  publicProjection: [],
  consumerIsolation: [],
  accountIsolation: [],
  shareIsolation: [],
  idempotency: [
    "pricing.createPriceList",
    "pricing.removePriceListEntries",
    "pricing.setPriceListEntries",
    "pricing.updatePriceList",
  ],
  events: [],
  atomic: [],
} as const satisfies SuiteCoverageManifest;
