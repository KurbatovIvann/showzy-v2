/**
 * System backfill of named catalog WebP renditions (SHO-248 / files-T16).
 * Global system write, internal, audited, idempotent. Empty input pages
 * ready `purpose=catalog` files whose derived keys are missing; `limit`
 * only bounds how many files receive PutObject work per tick. Keys are
 * derived from each row's `companyId`, never from input. `companyId` is
 * not an input field.
 *
 * Mechanical choices the feature card left unnamed:
 * - `timeout: 30000` covers Head+Get+sharp+Put for a fill batch of 20
 *   on Garage (same ceiling as `files.sweepAbandonedUploads`). HeadObject
 *   for a SQL page of 20 runs concurrently so already-complete files do
 *   not serialize the tick past the deadline.
 * - Batch default is 20. Optional `limit` bounds how many files receive
 *   PutObject work, not how many ready catalog rows are examined. SQL
 *   pages stay 20 even when `limit` is 1 so a tick walks past completes.
 *   The inherited idempotency suite conflicts on a different payload.
 * - Already-complete files (all four keys present) are no-ops and do
 *   not consume the fill budget, so a tick can walk past them to files
 *   that still need work. Missing originals and undecodable bytes are
 *   skipped and logged without consuming the fill budget, so one bad
 *   file cannot starve the rest of the catalog.
 * - Output is counts. Object keys, URLs, and file ids are omitted
 *   (security-operations.md §3).
 */
import { defineActionContract } from "@showzy/core/contract";
import { z } from "zod";

/** Bounded fill size; a later tick continues via createdAt/id keyset. */
export const BACKFILL_BATCH_LIMIT = 20;

export const backfillCatalogRenditionsInputSchema = z.object({
  limit: z.number().int().min(1).max(BACKFILL_BATCH_LIMIT).optional(),
});

export const backfillCatalogRenditionsOutputSchema = z.object({
  filled: z.number().int().nonnegative(),
  alreadyComplete: z.number().int().nonnegative(),
  skippedMissingOriginal: z.number().int().nonnegative(),
  skippedUndecodable: z.number().int().nonnegative(),
});

export const backfillCatalogRenditionsContract = defineActionContract({
  name: "files.backfillCatalogRenditions",
  description:
    "Backfill named catalog WebP renditions for ready purpose=catalog files whose derived keys are missing. Discovers ready catalog rows across companies in one bounded fill batch. Reuses the finalize encode pipeline (pixel cap, EXIF bake, no upscale, metadata stripping). Puts only missing {companyId}/catalog/{fileId}/{thumb|card|hero|full} objects. Does not rewrite originals, checksums, byte_size, object_key, or status. Skips purpose=document. Missing originals and undecodable bytes are skipped and logged so the rest of the page still completes. Object keys and URLs are never returned.",
  principal: "system",
  systemScope: "global",
  transport: "internal",
  input: backfillCatalogRenditionsInputSchema,
  output: backfillCatalogRenditionsOutputSchema,
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
