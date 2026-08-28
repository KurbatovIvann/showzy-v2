import type { SuiteCoverageManifest } from "@showzy/core";

export const customersSuiteCoverage = {
  isolation: [
    "customers.createGroup",
    "customers.getCustomerPricingFacts",
    "customers.updateGroup",
  ],
  publicProjection: [],
  consumerIsolation: [],
  accountIsolation: [],
  shareIsolation: [],
  idempotency: ["customers.createGroup", "customers.updateGroup"],
  events: [],
  atomic: [],
} as const satisfies SuiteCoverageManifest;
