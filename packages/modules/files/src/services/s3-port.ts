import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { CoreInvariantError } from "@showzy/core/errors";

import type { FileMimeType, StoredObjectMimeType } from "../wire.contract.js";

/** Short-lived signed URL lifetime (mechanical default, 15 minutes). */
export const SIGNED_URL_TTL_SEC = 15 * 60;

export interface FilesS3Config {
  readonly endpoint: string;
  /**
   * Host embedded in signed PUT/GET URLs. Defaults to `endpoint`. Split this
   * from `endpoint` when clients cannot reach the SDK endpoint (local Garage
   * on localhost vs a phone on the LAN).
   */
  readonly publicEndpoint?: string;
  readonly region: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly forcePathStyle: boolean;
  readonly bucket: string;
}

export interface SignedUrl {
  readonly url: string;
  readonly expiresAt: Date;
}

export interface ObjectIdentity {
  readonly byteSize: number;
  readonly etag: string;
}

export interface ObjectBytes extends ObjectIdentity {
  readonly bytes: Uint8Array;
}

export interface FilesObjectStore {
  signPut(input: {
    readonly key: string;
    readonly mimeType: FileMimeType;
    readonly byteSize: number;
  }): Promise<SignedUrl>;
  signGet(input: {
    readonly key: string;
    readonly mimeType: StoredObjectMimeType;
  }): Promise<SignedUrl>;
  headObject(key: string): Promise<ObjectIdentity | "missing">;
  getObject(key: string): Promise<ObjectBytes | "missing">;
  putObject(input: {
    readonly key: string;
    readonly mimeType: StoredObjectMimeType;
    readonly bytes: Uint8Array;
  }): Promise<void>;
  deleteObject(key: string): Promise<void>;
  probeBucket(): Promise<void>;
  close(): void;
}

let configured: FilesObjectStore | undefined;

export function configureFilesObjectStore(config: FilesS3Config): void {
  configured?.close();
  configured = createFilesObjectStore(config);
}

export function closeFilesObjectStore(): void {
  configured?.close();
  configured = undefined;
}

export function getFilesObjectStore(): FilesObjectStore {
  if (configured === undefined) {
    throw new CoreInvariantError(
      "files object store is not configured — bind it at process boot",
    );
  }
  return configured;
}

/**
 * Wrap the process-wide store and return a restore function. Finalize TOCTOU
 * tests use this to mutate staging after GetObject without adding a core hook.
 */
export function mapConfiguredFilesObjectStore(
  map: (store: FilesObjectStore) => FilesObjectStore,
): () => void {
  const inner = getFilesObjectStore();
  configured = map(inner);
  return () => {
    configured = inner;
  };
}

/** Strip S3 weak-validator prefixes and quotes so Head/Get ETags compare. */
export function normalizeObjectEtag(etag: string): string {
  const value =
    etag.startsWith("W/") || etag.startsWith("w/") ? etag.slice(2) : etag;
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  return value;
}

export interface FilesObjectStoreErrorCause {
  readonly code: string;
  readonly httpStatusCode?: number;
}

const TIMEOUT_CODES = new Set([
  "Timeout",
  "TimeoutError",
  "TimeoutErrorException",
  "RequestTimeout",
  "RequestTimeoutException",
  "ETIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
  "AbortError",
]);

function readErrorToken(error: object): string | undefined {
  if ("name" in error && typeof error.name === "string") {
    const name = error.name;
    if (name !== "" && name !== "Error" && name !== "S3ServiceException") {
      return name;
    }
  }
  if ("Code" in error && typeof error.Code === "string" && error.Code !== "") {
    return error.Code;
  }
  if ("code" in error && typeof error.code === "string" && error.code !== "") {
    return error.code;
  }
  return undefined;
}

function readHttpStatus(error: object): number | undefined {
  if (!("$metadata" in error)) {
    return undefined;
  }
  const metadata = error.$metadata;
  if (typeof metadata !== "object" || metadata === null) {
    return undefined;
  }
  if (!("httpStatusCode" in metadata)) {
    return undefined;
  }
  return typeof metadata.httpStatusCode === "number"
    ? metadata.httpStatusCode
    : undefined;
}

function classifyObjectStoreError(error: unknown): string {
  if (typeof error !== "object" || error === null) {
    return "Unknown";
  }
  const token = readErrorToken(error);
  const message = error instanceof Error ? error.message : "";
  if (
    (token !== undefined && TIMEOUT_CODES.has(token)) ||
    /\btimeout\b/i.test(message)
  ) {
    return "Timeout";
  }
  if (
    /checksum|bad[\s-]?digest|integrity|contentsha256|crc32|crc64/i.test(
      `${token ?? ""} ${message}`,
    )
  ) {
    return "ChecksumMismatch";
  }
  return token ?? "Unknown";
}

/** Stable, URL-free cause for Sentry. Never copies the AWS message. */
export function filesObjectStoreErrorCause(
  error: unknown,
): FilesObjectStoreErrorCause {
  const code = classifyObjectStoreError(error);
  const httpStatusCode =
    typeof error === "object" && error !== null
      ? readHttpStatus(error)
      : undefined;
  if (httpStatusCode === undefined) {
    return { code };
  }
  return { code, httpStatusCode };
}

function objectStoreFailureMessage(
  operation: string,
  cause: FilesObjectStoreErrorCause,
): string {
  if (cause.httpStatusCode === undefined) {
    return `files object store ${operation} failed (${cause.code})`;
  }
  return `files object store ${operation} failed (${cause.code}, http ${String(cause.httpStatusCode)})`;
}

function rethrowObjectStoreFailure(operation: string, error: unknown): never {
  if (error instanceof CoreInvariantError) {
    throw error;
  }
  const cause = filesObjectStoreErrorCause(error);
  throw new CoreInvariantError(objectStoreFailureMessage(operation, cause), {
    cause,
  });
}

export async function probeFilesObjectStore(): Promise<void> {
  await getFilesObjectStore().probeBucket();
}

function createS3Client(config: FilesS3Config, endpoint: string): S3Client {
  return new S3Client({
    region: config.region,
    endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    // Garage/R2 reject the SDK's default CRC32 request checksums.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

export function createFilesObjectStore(
  config: FilesS3Config,
): FilesObjectStore {
  const signEndpoint = config.publicEndpoint ?? config.endpoint;
  const dataClient = createS3Client(config, config.endpoint);
  const signClient =
    signEndpoint === config.endpoint
      ? dataClient
      : createS3Client(config, signEndpoint);
  const bucket = config.bucket;

  return {
    async signPut(input) {
      const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_SEC * 1000);
      try {
        const url = await getSignedUrl(
          signClient,
          new PutObjectCommand({
            Bucket: bucket,
            Key: input.key,
            ContentType: input.mimeType,
            ContentLength: input.byteSize,
          }),
          { expiresIn: SIGNED_URL_TTL_SEC },
        );
        return { url, expiresAt };
      } catch (error) {
        rethrowObjectStoreFailure("signPut", error);
      }
    },

    async signGet(input) {
      const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_SEC * 1000);
      try {
        const url = await getSignedUrl(
          signClient,
          new GetObjectCommand({
            Bucket: bucket,
            Key: input.key,
            ResponseContentType: input.mimeType,
            ResponseContentDisposition: downloadDisposition(input.mimeType),
          }),
          { expiresIn: SIGNED_URL_TTL_SEC },
        );
        return { url, expiresAt };
      } catch (error) {
        rethrowObjectStoreFailure("signGet", error);
      }
    },

    async headObject(key) {
      try {
        const result = await dataClient.send(
          new HeadObjectCommand({ Bucket: bucket, Key: key }),
        );
        const byteSize = result.ContentLength;
        if (byteSize === undefined) {
          throw new CoreInvariantError(
            "files object store HeadObject omitted ContentLength",
          );
        }
        return {
          byteSize,
          etag: requireObjectEtag(result.ETag, "HeadObject"),
        };
      } catch (error) {
        if (isMissingObject(error)) {
          return "missing";
        }
        rethrowObjectStoreFailure("HeadObject", error);
      }
    },

    async getObject(key) {
      try {
        const result = await dataClient.send(
          new GetObjectCommand({ Bucket: bucket, Key: key }),
        );
        const body = result.Body;
        if (body === undefined) {
          throw new CoreInvariantError(
            "files object store GetObject omitted Body",
          );
        }
        const bytes = await body.transformToByteArray();
        return {
          bytes,
          byteSize: bytes.byteLength,
          etag: requireObjectEtag(result.ETag, "GetObject"),
        };
      } catch (error) {
        if (isMissingObject(error)) {
          return "missing";
        }
        rethrowObjectStoreFailure("GetObject", error);
      }
    },

    async putObject(input) {
      try {
        await dataClient.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: input.key,
            Body: input.bytes,
            ContentType: input.mimeType,
            ContentLength: input.bytes.byteLength,
          }),
        );
      } catch (error) {
        rethrowObjectStoreFailure("PutObject", error);
      }
    },

    async deleteObject(key) {
      try {
        await dataClient.send(
          new DeleteObjectCommand({ Bucket: bucket, Key: key }),
        );
      } catch (error) {
        if (isMissingObject(error)) {
          return;
        }
        rethrowObjectStoreFailure("DeleteObject", error);
      }
    },

    async probeBucket() {
      try {
        await dataClient.send(new HeadBucketCommand({ Bucket: bucket }));
      } catch (error) {
        rethrowObjectStoreFailure("HeadBucket", error);
      }
    },

    close() {
      signClient.destroy();
      if (signClient !== dataClient) {
        dataClient.destroy();
      }
    },
  };
}

function requireObjectEtag(
  etag: string | undefined,
  operation: "HeadObject" | "GetObject",
): string {
  if (etag === undefined || etag.length === 0) {
    throw new CoreInvariantError(
      `files object store ${operation} omitted ETag`,
    );
  }
  return normalizeObjectEtag(etag);
}

function downloadFilename(mimeType: StoredObjectMimeType): string {
  switch (mimeType) {
    case "image/jpeg":
      return "catalog.jpg";
    case "image/png":
      return "catalog.png";
    case "image/webp":
      return "catalog.webp";
    case "application/pdf":
      return "document.pdf";
  }
}

/**
 * Catalog files are images. `inline` lets expo-image render the object.
 * Generated PDFs also use `inline` so the panel / share landing can open
 * them (SHO-229 contract note).
 */
function downloadDisposition(mimeType: StoredObjectMimeType): string {
  return `inline; filename="${downloadFilename(mimeType)}"`;
}

function isMissingObject(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  if ("name" in error && typeof error.name === "string") {
    if (error.name === "NotFound" || error.name === "NoSuchKey") {
      return true;
    }
  }
  if (!("$metadata" in error)) {
    return false;
  }
  const metadata = error.$metadata;
  if (typeof metadata !== "object" || metadata === null) {
    return false;
  }
  if (!("httpStatusCode" in metadata)) {
    return false;
  }
  return metadata.httpStatusCode === 404;
}
