import type { SuiteCoverageManifest } from "@showzy/core";

export const documentsSuiteCoverage = {
  isolation: ["documents.createFromOrder"],
  publicProjection: [],
  consumerIsolation: [],
  accountIsolation: [],
  shareIsolation: [],
  idempotency: ["documents.createFromOrder"],
  events: ["documents"],
  atomic: [],
} as const satisfies SuiteCoverageManifest;
