import { CoreInvariantError } from "@showzy/core/errors";
import { documentObjectKey, getFilesObjectStore } from "@showzy/files/storage";

import { PdfGenerationTerminalError } from "./pdf-retry.js";

/** Same ceiling as files `MAX_DOCUMENT_BYTES` (security-operations.md §3). */
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

export const DOCUMENT_MIME_TYPE = "application/pdf" as const;

/** Immediate first HeadObject, then 25ms × 2^n. */
const OBJECT_HEAD_POLL_MS = 25;
/** Never sleep a fixed 500ms+ visibility delay (SHO-290). */
const OBJECT_HEAD_POLL_MAX_MS = 200;
/** Tighter than the previous 10_000ms tight loop (SHO-290 mechanical default). */
const OBJECT_HEAD_TIMEOUT_MS = 4_000;

/**
 * Garage Head-after-Put can lag. Poll until the object is visible, then
 * fail loudly — production must not sleep a fixed duration.
 */
export async function waitForGeneratedObject(
  key: string,
  timeoutMs = OBJECT_HEAD_TIMEOUT_MS,
): Promise<void> {
  const store = getFilesObjectStore();
  const started = Date.now();
  let delayMs = OBJECT_HEAD_POLL_MS;
  for (;;) {
    const head = await store.headObject(key);
    if (head !== "missing") {
      return;
    }
    if (Date.now() - started > timeoutMs) {
      throw new CoreInvariantError(
        "generated PDF object was not visible to HeadObject after PutObject",
      );
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, delayMs);
    });
    delayMs = Math.min(delayMs * 2, OBJECT_HEAD_POLL_MAX_MS);
  }
}

export async function putGeneratedPdf(env: {
  readonly companyId: string;
  readonly fileId: string;
  readonly bytes: Uint8Array;
}): Promise<void> {
  if (env.bytes.byteLength < 1 || env.bytes.byteLength > MAX_DOCUMENT_BYTES) {
    throw new PdfGenerationTerminalError(
      "generated PDF byte size is outside the ceiling",
    );
  }
  const key = documentObjectKey(env.companyId, env.fileId);
  const store = getFilesObjectStore();
  await store.putObject({
    key,
    mimeType: DOCUMENT_MIME_TYPE,
    bytes: env.bytes,
  });
  await waitForGeneratedObject(key);
}
