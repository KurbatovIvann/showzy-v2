import type { SuiteCoverageManifest } from "@showzy/core";

export const pricingSuiteCoverage = {
  isolation: [
    "pricing.activatePriceList",
    "pricing.createPriceList",
    "pricing.deactivatePriceList",
    "pricing.getPriceList",
    "pricing.listPriceListEntries",
    "pricing.listPriceLists",
    "pricing.removePriceListEntries",
    "pricing.resolveProductPrices",
    "pricing.setDefaultPriceList",
    "pricing.setPriceListEntries",
    "pricing.updatePriceList",
  ],
  publicProjection: [],
  consumerIsolation: [],
  accountIsolation: [],
  shareIsolation: [],
  idempotency: [
    "pricing.activatePriceList",
    "pricing.createPriceList",
    "pricing.deactivatePriceList",
    "pricing.removePriceListEntries",
    "pricing.setDefaultPriceList",
    "pricing.setPriceListEntries",
    "pricing.updatePriceList",
  ],
  events: [],
  atomic: [],
} as const satisfies SuiteCoverageManifest;
