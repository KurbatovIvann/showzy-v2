import type { ActionCtx } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";
import { files } from "@showzy/db/schema/files";
import { and, asc, eq, gt, or } from "drizzle-orm";
import type { z } from "zod";

import {
  BACKFILL_BATCH_LIMIT,
  type backfillCatalogRenditionsInputSchema,
} from "../actions/backfill-catalog-renditions.contract.js";
import { CATALOG_RENDITIONS, type CatalogRendition } from "../wire.contract.js";
import { encodeCatalogRenditions } from "./catalog-renditions.js";
import { catalogObjectKey, catalogRenditionObjectKey } from "./object-key.js";
import { getFilesObjectStore, type FilesObjectStore } from "./s3-port.js";
import { requireWritable } from "./writable.js";

type SystemGlobalCtx = Extract<
  ActionCtx,
  { principal: "system"; scope: "global" }
>;
type BackfillInput = z.output<typeof backfillCatalogRenditionsInputSchema>;
type FileRow = typeof files.$inferSelect;
type WritableDb = ReturnType<typeof requireWritable>;

export interface BackfillCatalogRenditionsResult {
  readonly filled: number;
  readonly alreadyComplete: number;
  readonly skippedMissingOriginal: number;
  readonly skippedUndecodable: number;
}

type SkipReason = "missing_original" | "undecodable";

type FileOutcome =
  | "filled"
  | "already_complete"
  | "missing_original"
  | "undecodable";

interface KeysetCursor {
  readonly createdAt: Date;
  readonly id: string;
}

interface InspectedCatalogFile {
  readonly row: FileRow;
  readonly missing: readonly CatalogRendition[];
}

/** Concurrent files HeadObject'd per SQL page — enough to pipeline Garage, not a stampede. */
const HEAD_FILE_CONCURRENCY = 8;

export async function runCatalogRenditionBackfill(input: {
  readonly ctx: SystemGlobalCtx;
  readonly input: BackfillInput;
}): Promise<BackfillCatalogRenditionsResult> {
  const db = requireWritable(input.ctx.db);
  const fillBudget = input.input.limit ?? BACKFILL_BATCH_LIMIT;
  const store = getFilesObjectStore();

  let filled = 0;
  let alreadyComplete = 0;
  let skippedMissingOriginal = 0;
  let skippedUndecodable = 0;
  let cursor: KeysetCursor | undefined;

  // SQL pages are always BACKFILL_BATCH_LIMIT so a tick with `limit: 1`
  // still walks past already-complete files. Completes do not consume
  // fill budget — otherwise the oldest 20 ready rows would starve later
  // legacy files once T15 had filled them. HeadObject for a page runs
  // concurrently; Get/encode/Put stays per-file so one failure cannot
  // leave a different file half-written in the same tick.
  while (filled < fillBudget) {
    throwIfAborted(input.ctx);
    const page = await loadReadyCatalogPage({
      db,
      cursor,
      limit: BACKFILL_BATCH_LIMIT,
    });
    if (page.length === 0) {
      break;
    }
    const inspected = await inspectCatalogPage({ store, page });
    for (const item of inspected) {
      throwIfAborted(input.ctx);
      const outcome = await backfillReadyCatalogFile({
        ctx: input.ctx,
        store,
        row: item.row,
        missing: item.missing,
      });
      switch (outcome) {
        case "filled":
          filled += 1;
          break;
        case "already_complete":
          alreadyComplete += 1;
          break;
        case "missing_original":
          skippedMissingOriginal += 1;
          break;
        case "undecodable":
          skippedUndecodable += 1;
          break;
      }
      cursor = { createdAt: item.row.createdAt, id: item.row.id };
      if (filled >= fillBudget) {
        break;
      }
    }
  }

  input.ctx.log.info(
    {
      filled,
      already_complete: alreadyComplete,
      skipped_missing_original: skippedMissingOriginal,
      skipped_undecodable: skippedUndecodable,
    },
    "files.backfillCatalogRenditions finished",
  );

  return {
    filled,
    alreadyComplete,
    skippedMissingOriginal,
    skippedUndecodable,
  };
}

async function loadReadyCatalogPage(input: {
  readonly db: WritableDb;
  readonly cursor: KeysetCursor | undefined;
  readonly limit: number;
}): Promise<readonly FileRow[]> {
  const readyCatalog = and(
    eq(files.status, "ready"),
    eq(files.purpose, "catalog"),
  );
  const where =
    input.cursor === undefined
      ? readyCatalog
      : and(
          readyCatalog,
          or(
            gt(files.createdAt, input.cursor.createdAt),
            and(
              eq(files.createdAt, input.cursor.createdAt),
              gt(files.id, input.cursor.id),
            ),
          ),
        );

  return input.db
    .select()
    .from(files)
    .where(where)
    .orderBy(asc(files.createdAt), asc(files.id))
    .limit(input.limit);
}

async function inspectCatalogPage(input: {
  readonly store: FilesObjectStore;
  readonly page: readonly FileRow[];
}): Promise<readonly InspectedCatalogFile[]> {
  return mapPool(input.page, HEAD_FILE_CONCURRENCY, async (row) => ({
    row,
    missing: await missingCatalogRenditions({
      store: input.store,
      companyId: row.companyId,
      fileId: row.id,
    }),
  }));
}

async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }
  const results: R[] = [];
  let next = 0;
  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      for (;;) {
        const index = next;
        next += 1;
        if (index >= items.length) {
          return;
        }
        const item = items[index];
        if (item === undefined) {
          return;
        }
        results[index] = await mapper(item);
      }
    }),
  );
  return results;
}

async function backfillReadyCatalogFile(input: {
  readonly ctx: SystemGlobalCtx;
  readonly store: FilesObjectStore;
  readonly row: FileRow;
  readonly missing: readonly CatalogRendition[];
}): Promise<FileOutcome> {
  if (input.missing.length === 0) {
    return "already_complete";
  }

  const original = await input.store.getObject(
    catalogObjectKey(input.row.companyId, input.row.id),
  );
  if (original === "missing") {
    logSkip(input.ctx, "missing_original");
    return "missing_original";
  }

  const encoded = await encodeCatalogRenditions(original.bytes);
  if (encoded === "undecodable") {
    logSkip(input.ctx, "undecodable");
    return "undecodable";
  }

  await Promise.all(
    input.missing.map((rendition) =>
      input.store.putObject({
        key: catalogRenditionObjectKey(
          input.row.companyId,
          input.row.id,
          rendition,
        ),
        mimeType: "image/webp",
        bytes: encoded[rendition],
      }),
    ),
  );
  return "filled";
}

async function missingCatalogRenditions(input: {
  readonly store: FilesObjectStore;
  readonly companyId: string;
  readonly fileId: string;
}): Promise<readonly CatalogRendition[]> {
  const heads = await Promise.all(
    CATALOG_RENDITIONS.map(async (rendition) => {
      const head = await input.store.headObject(
        catalogRenditionObjectKey(input.companyId, input.fileId, rendition),
      );
      return { rendition, missing: head === "missing" };
    }),
  );
  return heads
    .filter((entry) => entry.missing)
    .map((entry) => entry.rendition);
}

function throwIfAborted(ctx: SystemGlobalCtx): void {
  if (!ctx.signal.aborted) {
    return;
  }
  const reason: unknown = ctx.signal.reason;
  if (reason instanceof Error) {
    throw reason;
  }
  throw new CoreInvariantError("files.backfillCatalogRenditions aborted");
}

function logSkip(ctx: SystemGlobalCtx, skipReason: SkipReason): void {
  ctx.log.info(
    { skip_reason: skipReason },
    "files.backfillCatalogRenditions skipped file",
  );
}
