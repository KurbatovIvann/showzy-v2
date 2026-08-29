import type { SuiteCoverageManifest } from "@showzy/core";

export const documentsSuiteCoverage = {
  isolation: [
    "documents.cancel",
    "documents.createFromOrder",
    "documents.get",
    "documents.list",
  ],
  publicProjection: [],
  consumerIsolation: [],
  accountIsolation: [],
  shareIsolation: [],
  idempotency: ["documents.cancel", "documents.createFromOrder"],
  events: ["documents"],
  atomic: [],
} as const satisfies SuiteCoverageManifest;
