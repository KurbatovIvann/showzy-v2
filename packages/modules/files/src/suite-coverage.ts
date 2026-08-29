import type { SuiteCoverageManifest } from "@showzy/core";

export const filesSuiteCoverage = {
  isolation: [
    "files.requestUpload",
    "files.getUploadUrl",
    "files.finalizeUpload",
    "files.getDownloadUrl",
    "files.getDownloadUrls",
    "files.getAttachmentFacts",
    "files.issueDocumentDownloadUrl",
    "files.issueShareDownloadUrl",
    "files.recordGeneratedObject",
    "files.sweepAbandonedUploads",
  ],
  publicProjection: [],
  consumerIsolation: [],
  accountIsolation: [],
  shareIsolation: [],
  idempotency: [
    "files.requestUpload",
    "files.finalizeUpload",
    "files.recordGeneratedObject",
    "files.sweepAbandonedUploads",
  ],
  events: [],
  atomic: [],
} as const satisfies SuiteCoverageManifest;
