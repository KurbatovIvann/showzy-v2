import type { SuiteCoverageManifest } from "@showzy/core";

export const companiesSuiteCoverage = {
  isolation: ["companies.listMine"],
  publicProjection: [],
  consumerIsolation: [],
  accountIsolation: ["companies.listMine"],
  shareIsolation: [],
  idempotency: [],
  events: [],
  atomic: [],
} as const satisfies SuiteCoverageManifest;
