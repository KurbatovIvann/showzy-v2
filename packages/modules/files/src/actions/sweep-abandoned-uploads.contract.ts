/**
 * System GC for handshake leftovers (SHO-115 / files-T6). Global system
 * write, internal, audited, idempotent. Empty input discovers leftover
 * ready staging and abandoned pending rows; `limit` only bounds the
 * batch. Keys are derived from each locked row's `companyId`, never from
 * input. `companyId` is not an input field.
 *
 * Mechanical choices the feature card left unnamed:
 * - `timeout: 30000` covers Head+Delete for a batch of 20 on Garage.
 * - Abandoned pending TTL is 1 hour (4× the 15-minute PUT TTL) so an
 *   in-flight handshake is not swept. Ready leftover staging is deleted
 *   without waiting — download never reads it.
 * - Batch default is 20. Optional `limit` exists so the inherited
 *   idempotency suite can conflict on a different payload; the handler
 *   still caps at this default.
 * - Output is counts. Object keys, URLs, and file ids are omitted
 *   (security-operations.md §3).
 */
import { defineActionContract } from "@showzy/core/contract";
import { z } from "zod";

/** 1 hour — 4× the 15-minute signed PUT TTL (`SIGNED_URL_TTL_SEC`). */
export const ABANDONED_PENDING_TTL_MS = 4 * 15 * 60 * 1000;

/** Bounded scan size; a later tick continues via SKIP LOCKED. */
export const SWEEP_BATCH_LIMIT = 20;

export const sweepAbandonedUploadsInputSchema = z.object({
  limit: z.number().int().min(1).max(SWEEP_BATCH_LIMIT).optional(),
});

export const sweepAbandonedUploadsOutputSchema = z.object({
  leftoverStagingDeleted: z.number().int().nonnegative(),
  abandonedPendingDeleted: z.number().int().nonnegative(),
});

export const sweepAbandonedUploadsContract = defineActionContract({
  name: "files.sweepAbandonedUploads",
  description:
    "Sweep leftover private catalog storage across companies. Discovers ready files with leftover handshake staging and pending files older than the abandoned TTL, in one bounded batch. Ready files lose only the staging object. Abandoned pending files lose staging, any catalog object left after a failed finalize, and the pending row. In-flight pending files are left alone. Object keys and URLs are never returned.",
  principal: "system",
  systemScope: "global",
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
  timeout: 30_000,
});
