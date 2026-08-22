import type { SuiteCoverageManifest } from "@showzy/core";

export const filesSuiteCoverage = {
  isolation: [
    "files.requestUpload",
    "files.finalizeUpload",
    "files.getDownloadUrl",
    "files.getAttachmentFacts",
  ],
  publicProjection: [],
  consumerIsolation: [],
  accountIsolation: [],
  shareIsolation: [],
  idempotency: ["files.requestUpload", "files.finalizeUpload"],
  events: [],
  atomic: [],
} as const satisfies SuiteCoverageManifest;
