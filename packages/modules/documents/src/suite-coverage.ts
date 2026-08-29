import type { SuiteCoverageManifest } from "@showzy/core";

export const documentsSuiteCoverage = {
  isolation: [
    "documents.cancel",
    "documents.createFromOrder",
    "documents.get",
    "documents.getForGeneration",
    "documents.getShared",
    "documents.list",
    "documents.share",
  ],
  publicProjection: [],
  consumerIsolation: [],
  accountIsolation: [],
  shareIsolation: [],
  idempotency: [
    "documents.cancel",
    "documents.createFromOrder",
    "documents.share",
  ],
  events: ["documents"],
  atomic: [],
} as const satisfies SuiteCoverageManifest;
