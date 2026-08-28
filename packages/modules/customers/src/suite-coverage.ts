import type { SuiteCoverageManifest } from "@showzy/core";

export const customersSuiteCoverage = {
  isolation: [
    "customers.createCustomer",
    "customers.createGroup",
    "customers.getCustomerPricingFacts",
    "customers.updateCustomer",
    "customers.updateGroup",
  ],
  publicProjection: [],
  consumerIsolation: [],
  accountIsolation: [],
  shareIsolation: [],
  idempotency: [
    "customers.createCustomer",
    "customers.createGroup",
    "customers.updateCustomer",
    "customers.updateGroup",
  ],
  events: [],
  atomic: [],
} as const satisfies SuiteCoverageManifest;
