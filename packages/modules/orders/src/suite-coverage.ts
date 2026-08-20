import type { SuiteCoverageManifest } from "@showzy/core";

export const ordersSuiteCoverage = {
  isolation: ["orders.create", "orders.confirm", "orders.get"],
  publicProjection: [],
  consumerIsolation: [],
  accountIsolation: [],
  shareIsolation: [],
  idempotency: ["orders.create", "orders.confirm"],
  events: ["orders"],
  atomic: [],
} as const satisfies SuiteCoverageManifest;
