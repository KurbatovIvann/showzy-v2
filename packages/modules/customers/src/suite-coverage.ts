import type { SuiteCoverageManifest } from "@showzy/core";

export const customersSuiteCoverage = {
  isolation: [
    "customers.archiveCustomer",
    "customers.createCustomer",
    "customers.createGroup",
    "customers.deleteGroup",
    "customers.getCustomerPricingFacts",
    "customers.getGroup",
    "customers.listGroups",
    "customers.restoreCustomer",
    "customers.updateCustomer",
    "customers.updateGroup",
  ],
  publicProjection: [],
  consumerIsolation: [],
  accountIsolation: [],
  shareIsolation: [],
  idempotency: [
    "customers.archiveCustomer",
    "customers.createCustomer",
    "customers.createGroup",
    "customers.deleteGroup",
    "customers.restoreCustomer",
    "customers.updateCustomer",
    "customers.updateGroup",
  ],
  events: [],
  atomic: [],
} as const satisfies SuiteCoverageManifest;
