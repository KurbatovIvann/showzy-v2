import type { SuiteCoverageManifest } from "@showzy/core";

/**
 * Isolation lists every registered action (core.md §12). Abandon is
 * delivery-backed so it stays off idempotency; start is a client write
 * with `idempotent: true` and instantiates idempotencySuite.
 */
export const docSigningSuiteCoverage = {
  isolation: [
    "docSigning.abandonRequest",
    "docSigning.get",
    "docSigning.getSupplierSignedFlags",
    "docSigning.start",
  ],
  publicProjection: [],
  consumerIsolation: [],
  accountIsolation: [],
  shareIsolation: [],
  idempotency: ["docSigning.start"],
  events: ["docSigning"],
  atomic: [],
} as const satisfies SuiteCoverageManifest;
