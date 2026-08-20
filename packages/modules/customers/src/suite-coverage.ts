import type { SuiteCoverageManifest } from "@showzy/core";

export const customersSuiteCoverage = {
  isolation: ["customers.getCustomerPricingFacts"],
  publicProjection: [],
  consumerIsolation: [],
  accountIsolation: [],
  shareIsolation: [],
  idempotency: [],
  events: [],
  atomic: [],
} as const satisfies SuiteCoverageManifest;
