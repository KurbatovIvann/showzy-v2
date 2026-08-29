import type { SuiteCoverageManifest } from "@showzy/core";

export const documentsSuiteCoverage = {
  isolation: ["documents.createFromOrder", "documents.get", "documents.list"],
  publicProjection: [],
  consumerIsolation: [],
  accountIsolation: [],
  shareIsolation: [],
  idempotency: ["documents.createFromOrder"],
  events: ["documents"],
  atomic: [],
} as const satisfies SuiteCoverageManifest;
