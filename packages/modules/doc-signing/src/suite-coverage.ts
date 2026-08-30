import type { SuiteCoverageManifest } from "@showzy/core";

/**
 * Isolation lists the system abandon write as well as the staff reads
 * because the contract check requires every registered action in
 * crossTenantSuite (core.md §12). Idempotency is omitted: the write is
 * delivery-backed.
 */
export const docSigningSuiteCoverage = {
  isolation: [
    "docSigning.abandonRequest",
    "docSigning.get",
    "docSigning.getSupplierSignedFlags",
  ],
  publicProjection: [],
  consumerIsolation: [],
  accountIsolation: [],
  shareIsolation: [],
  idempotency: [],
  events: ["docSigning"],
  atomic: [],
} as const satisfies SuiteCoverageManifest;
