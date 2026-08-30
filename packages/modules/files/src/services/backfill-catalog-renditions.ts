import type { ActionCtx } from "@showzy/core";
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
  "filled" | "already_complete" | "missing_original" | "undecodable";

interface KeysetCursor {
  readonly createdAt: Date;
  readonly id: string;
}

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

  while (filled < fillBudget) {
    const page = await loadReadyCatalogPage({ db, cursor, limit: fillBudget });
    if (page.length === 0) {
      break;
    }
    for (const row of page) {
      const outcome = await backfillReadyCatalogFile({
        ctx: input.ctx,
        store,
        row,
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
      cursor = { createdAt: row.createdAt, id: row.id };
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

async function backfillReadyCatalogFile(input: {
  readonly ctx: SystemGlobalCtx;
  readonly store: FilesObjectStore;
  readonly row: FileRow;
}): Promise<FileOutcome> {
  const missing = await missingCatalogRenditions({
    store: input.store,
    companyId: input.row.companyId,
    fileId: input.row.id,
  });
  if (missing.length === 0) {
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

  for (const rendition of missing) {
    await input.store.putObject({
      key: catalogRenditionObjectKey(
        input.row.companyId,
        input.row.id,
        rendition,
      ),
      mimeType: "image/webp",
      bytes: encoded[rendition],
    });
  }
  return "filled";
}

async function missingCatalogRenditions(input: {
  readonly store: FilesObjectStore;
  readonly companyId: string;
  readonly fileId: string;
}): Promise<CatalogRendition[]> {
  const missing: CatalogRendition[] = [];
  for (const rendition of CATALOG_RENDITIONS) {
    const head = await input.store.headObject(
      catalogRenditionObjectKey(input.companyId, input.fileId, rendition),
    );
    if (head === "missing") {
      missing.push(rendition);
    }
  }
  return missing;
}

function logSkip(ctx: SystemGlobalCtx, skipReason: SkipReason): void {
  ctx.log.info(
    { skip_reason: skipReason },
    "files.backfillCatalogRenditions skipped file",
  );
}
