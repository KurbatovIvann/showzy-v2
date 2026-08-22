/**
 * System GC for handshake leftovers (SHO-115 / files-T6). Copies
 * `chat.upsertOrderCard`: tenant-scoped system write, internal, audited,
 * idempotent. `fileId` is a selector inside `ctx.companyId`, never an
 * access grant.
 *
 * Mechanical choices the feature card left unnamed:
 * - `timeout: 15000` matches finalize (two DeleteObject round-trips on
 *   Garage, including a missing-key case).
 * - Abandoned pending TTL is 1 hour (4× the 15-minute PUT TTL) so an
 *   in-flight handshake is not swept. Ready leftover staging is deleted
 *   without waiting — download never reads it.
 * - Output is counts/flags plus `fileId`. Object keys and URLs are
 *   omitted (security-operations.md §3).
 */
import { defineActionContract } from "@showzy/core/contract";
import { z } from "zod";

/** 1 hour — 4× the 15-minute signed PUT TTL (`SIGNED_URL_TTL_SEC`). */
export const ABANDONED_PENDING_TTL_MS = 4 * 15 * 60 * 1000;

export const sweepAbandonedUploadsInputSchema = z.object({
  fileId: z.uuid(),
});

export const sweepAbandonedUploadsOutputSchema = z.object({
  fileId: z.uuid(),
  deletedPendingRow: z.boolean(),
  deletedStaging: z.boolean(),
  deletedCatalog: z.boolean(),
});

export const sweepAbandonedUploadsContract = defineActionContract({
  name: "files.sweepAbandonedUploads",
  description:
    "Sweep leftover private catalog storage for one file in the enqueued company. Ready files lose only the handshake staging object. Pending files older than the abandoned TTL lose staging, any catalog object left after a failed finalize, and the pending row. In-flight pending files are left alone. Missing or foreign-company files fail with not-found. Object keys and URLs are never returned.",
  principal: "system",
  systemScope: "tenant",
  transport: "internal",
  input: sweepAbandonedUploadsInputSchema,
  output: sweepAbandonedUploadsOutputSchema,
  permissions: [],
  aiExposure: "internal",
  risk: "write",
  requiresConfirmation: false,
  idempotent: true,
  emits: [],
  atomicCalls: [],
  atomicCallers: [],
  audit: true,
  timeout: 15_000,
});
