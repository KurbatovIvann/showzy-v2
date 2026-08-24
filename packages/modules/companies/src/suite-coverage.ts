import type { SuiteCoverageManifest } from "@showzy/core";

export const companiesSuiteCoverage = {
  isolation: ["companies.listMine", "companies.create"],
  publicProjection: [],
  consumerIsolation: [],
  accountIsolation: ["companies.listMine", "companies.create"],
  shareIsolation: [],
  idempotency: ["companies.create"],
  events: [],
  atomic: [],
} as const satisfies SuiteCoverageManifest;
