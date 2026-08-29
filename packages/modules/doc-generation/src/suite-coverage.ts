import type { SuiteCoverageManifest } from "@showzy/core";

export const docGenerationSuiteCoverage = {
  isolation: ["docGeneration.getArtifact", "docGeneration.renderPdf"],
  publicProjection: [],
  consumerIsolation: [],
  accountIsolation: [],
  shareIsolation: [],
  idempotency: [],
  events: ["docGeneration"],
  atomic: [
    {
      caller: "docGeneration.renderPdf",
      callee: "files.recordGeneratedObject",
    },
  ],
} as const satisfies SuiteCoverageManifest;
