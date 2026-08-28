import type { SuiteCoverageManifest } from "@showzy/core";

export const customersSuiteCoverage = {
  isolation: [
    "customers.createGroup",
    "customers.deleteGroup",
    "customers.getCustomerPricingFacts",
    "customers.getGroup",
    "customers.listGroups",
    "customers.updateGroup",
  ],
  publicProjection: [],
  consumerIsolation: [],
  accountIsolation: [],
  shareIsolation: [],
  idempotency: [
    "customers.createGroup",
    "customers.deleteGroup",
    "customers.updateGroup",
  ],
  events: [],
  atomic: [],
} as const satisfies SuiteCoverageManifest;
