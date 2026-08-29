import type { SuiteCoverageManifest } from "@showzy/core";

export const invitesSuiteCoverage = {
  isolation: [
    "invites.create",
    "invites.get",
    "invites.list",
    "invites.revoke",
  ],
  publicProjection: [],
  consumerIsolation: [],
  accountIsolation: [],
  shareIsolation: [],
  idempotency: ["invites.create", "invites.revoke"],
  events: ["invites"],
  atomic: [],
} as const satisfies SuiteCoverageManifest;
