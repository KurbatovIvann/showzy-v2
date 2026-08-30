import type { SuiteCoverageManifest } from "@showzy/core";

export const documentsSuiteCoverage = {
  isolation: [
    "documents.cancel",
    "documents.createFromOrder",
    "documents.get",
    "documents.getForGeneration",
    "documents.getShared",
    "documents.list",
    "documents.lockIssuedForSigning",
    "documents.requestSign",
    "documents.share",
  ],
  publicProjection: [],
  consumerIsolation: [],
  accountIsolation: [],
  shareIsolation: [],
  idempotency: [
    "documents.cancel",
    "documents.createFromOrder",
    "documents.requestSign",
    "documents.share",
  ],
  events: ["documents"],
  atomic: [],
} as const satisfies SuiteCoverageManifest;
