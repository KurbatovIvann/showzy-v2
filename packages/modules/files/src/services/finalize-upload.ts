import type { ActionCtx } from "@showzy/core";
import { CoreInvariantError, NotFoundError } from "@showzy/core/errors";
import { files } from "@showzy/db/schema/files";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";

import type { finalizeUploadInputSchema } from "../actions/finalize-upload.contract.js";
import {
  CATALOG_RENDITIONS,
  MAX_UPLOAD_BYTES,
  type CatalogRendition,
  type FileMimeType,
} from "../wire.contract.js";
import {
  encodeCatalogRenditions,
  type CatalogRenditionBuffers,
} from "./catalog-renditions.js";
import { sha256Hex } from "./checksum.js";
import {
  requireDeclaredMime,
  toReadyView,
  type FileReadyView,
} from "./file-view.js";
import { uploadBytesMatchDeclaredMime } from "./magic-bytes.js";
import {
  catalogObjectKey,
  catalogRenditionObjectKey,
  stagingObjectKey,
} from "./object-key.js";
import {
  getFilesObjectStore,
  type FilesObjectStore,
  type ObjectBytes,
} from "./s3-port.js";
import { uploadedObjectInvalid } from "./uploaded-object.js";
import { requireWritable } from "./writable.js";

type StaffCtx = Extract<ActionCtx, { principal: "staff" }>;
type FinalizeInput = z.output<typeof finalizeUploadInputSchema>;
type FileRow = typeof files.$inferSelect;
type WritableDb = ReturnType<typeof requireWritable>;

interface PendingUploadMeta {
  readonly checksumSha256: string;
  readonly declaredSize: number;
  readonly mimeType: FileMimeType;
}

export async function finalizeStaffUpload(input: {
  readonly ctx: StaffCtx;
  readonly input: FinalizeInput;
}): Promise<FileReadyView> {
  const db = requireWritable(input.ctx.db);
  const companyId = input.ctx.companyId;
  const fileId = input.input.fileId;

  const unlocked = await loadFileRow({
    db,
    companyId,
    fileId,
    lock: false,
  });
  if (unlocked.status === "ready") {
    await fillMissingCatalogRenditions({
      store: getFilesObjectStore(),
      companyId,
      fileId: unlocked.id,
    });
    return toReadyView(unlocked);
  }
  requirePending(unlocked);

  const catalogKey = catalogObjectKey(companyId, unlocked.id);
  const stagingKey = stagingObjectKey(companyId, unlocked.id);
  const declared = requirePendingUploadMeta(unlocked, catalogKey);

  const store = getFilesObjectStore();
  const staged = await readValidatedStaging({
    store,
    stagingKey,
    declared,
  });

  const locked = await loadFileRow({
    db,
    companyId,
    fileId,
    lock: true,
  });
  if (locked.status === "ready") {
    await fillMissingCatalogRenditions({
      store,
      companyId,
      fileId: locked.id,
    });
    return toReadyView(locked);
  }
  requirePending(locked);
  const lockedMeta = requirePendingUploadMeta(locked, catalogKey);
  if (
    lockedMeta.checksumSha256 !== declared.checksumSha256 ||
    lockedMeta.declaredSize !== declared.declaredSize ||
    lockedMeta.mimeType !== declared.mimeType
  ) {
    throw uploadedObjectInvalid();
  }

  const head = await store.headObject(stagingKey);
  if (
    head === "missing" ||
    head.byteSize !== staged.byteSize ||
    head.etag !== staged.etag
  ) {
    throw uploadedObjectInvalid();
  }

  // Durable catalog bytes are the already-hashed buffer (owner call
  // 2026-08-22). Encode renditions from that buffer first so an
  // undecodable / over-limit image never writes objects. PutObject of
  // the original then the four WebP keys runs only while the row is
  // still pending under FOR UPDATE so a leftover PUT cannot overwrite a
  // ready catalog key. Ready is written last: ready ⇒ original + four.
  const encoded = await encodeCatalogRenditions(staged.bytes);
  if (encoded === "undecodable") {
    throw uploadedObjectInvalid();
  }

  await store.putObject({
    key: catalogKey,
    mimeType: declared.mimeType,
    bytes: staged.bytes,
  });
  await putCatalogRenditionObjects({
    store,
    companyId,
    fileId: locked.id,
    encoded,
  });

  const updated = await db
    .update(files)
    .set({
      status: "ready",
      byteSize: BigInt(staged.byteSize),
      checksumSha256: declared.checksumSha256,
    })
    .where(
      and(
        eq(files.companyId, companyId),
        eq(files.id, locked.id),
        eq(files.status, "pending"),
      ),
    )
    .returning();
  const saved = updated[0];
  if (saved === undefined) {
    const raced = await loadFileRow({
      db,
      companyId,
      fileId: locked.id,
      lock: false,
    });
    if (raced.status !== "ready") {
      throw new CoreInvariantError("files.finalizeUpload lost the row");
    }
    return toReadyView(raced);
  }

  input.ctx.log.info(
    {
      file_id: saved.id,
      mime_type: saved.mimeType,
      byte_size: staged.byteSize,
    },
    "files.finalizeUpload marked file ready",
  );

  return toReadyView(saved);
}

async function loadFileRow(input: {
  readonly db: WritableDb;
  readonly companyId: string;
  readonly fileId: string;
  readonly lock: boolean;
}): Promise<FileRow> {
  const query = input.db
    .select()
    .from(files)
    .where(
      and(
        eq(files.companyId, input.companyId),
        eq(files.id, input.fileId),
        eq(files.purpose, "catalog"),
      ),
    )
    .limit(1);
  const rows = input.lock ? await query.for("update") : await query;
  const row = rows[0];
  if (row === undefined) {
    throw new NotFoundError();
  }
  return row;
}

function requirePending(row: FileRow): void {
  if (row.status !== "pending") {
    throw new CoreInvariantError("files.finalizeUpload saw an unknown status");
  }
}

function requirePendingUploadMeta(
  row: FileRow,
  catalogKey: string,
): PendingUploadMeta {
  if (row.objectKey !== catalogKey) {
    throw uploadedObjectInvalid();
  }
  if (row.checksumSha256 === null) {
    throw uploadedObjectInvalid();
  }
  const declaredSize = Number(row.byteSize);
  if (!Number.isSafeInteger(declaredSize) || declaredSize < 1) {
    throw uploadedObjectInvalid();
  }
  return {
    checksumSha256: row.checksumSha256,
    declaredSize,
    mimeType: requireDeclaredMime(row.mimeType),
  };
}

async function readValidatedStaging(input: {
  readonly store: FilesObjectStore;
  readonly stagingKey: string;
  readonly declared: PendingUploadMeta;
}): Promise<ObjectBytes> {
  const head = await input.store.headObject(input.stagingKey);
  if (head === "missing") {
    throw uploadedObjectInvalid();
  }
  if (
    head.byteSize !== input.declared.declaredSize ||
    head.byteSize > MAX_UPLOAD_BYTES
  ) {
    throw uploadedObjectInvalid();
  }

  const object = await input.store.getObject(input.stagingKey);
  if (object === "missing" || object.byteSize !== input.declared.declaredSize) {
    throw uploadedObjectInvalid();
  }
  if (!uploadBytesMatchDeclaredMime(object.bytes, input.declared.mimeType)) {
    throw uploadedObjectInvalid();
  }
  if (sha256Hex(object.bytes) !== input.declared.checksumSha256) {
    throw uploadedObjectInvalid();
  }
  return object;
}

async function putCatalogRenditionObjects(input: {
  readonly store: FilesObjectStore;
  readonly companyId: string;
  readonly fileId: string;
  readonly encoded: CatalogRenditionBuffers;
}): Promise<void> {
  for (const rendition of CATALOG_RENDITIONS) {
    await input.store.putObject({
      key: catalogRenditionObjectKey(input.companyId, input.fileId, rendition),
      mimeType: "image/webp",
      bytes: input.encoded[rendition],
    });
  }
}

async function fillMissingCatalogRenditions(input: {
  readonly store: FilesObjectStore;
  readonly companyId: string;
  readonly fileId: string;
}): Promise<void> {
  const missing: CatalogRendition[] = [];
  for (const rendition of CATALOG_RENDITIONS) {
    const head = await input.store.headObject(
      catalogRenditionObjectKey(input.companyId, input.fileId, rendition),
    );
    if (head === "missing") {
      missing.push(rendition);
    }
  }
  if (missing.length === 0) {
    return;
  }

  const original = await input.store.getObject(
    catalogObjectKey(input.companyId, input.fileId),
  );
  if (original === "missing") {
    throw new CoreInvariantError(
      "files.finalizeUpload missing catalog object on a ready row",
    );
  }
  const encoded = await encodeCatalogRenditions(original.bytes);
  if (encoded === "undecodable") {
    throw uploadedObjectInvalid();
  }
  for (const rendition of missing) {
    await input.store.putObject({
      key: catalogRenditionObjectKey(input.companyId, input.fileId, rendition),
      mimeType: "image/webp",
      bytes: encoded[rendition],
    });
  }
}
