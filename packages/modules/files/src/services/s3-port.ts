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

import type { FileMimeType } from "../wire.contract.js";

/** Short-lived signed URL lifetime (mechanical default, 15 minutes). */
export const SIGNED_URL_TTL_SEC = 15 * 60;

export interface FilesS3Config {
  readonly endpoint: string;
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

export interface ObjectBytes {
  readonly bytes: Uint8Array;
  readonly byteSize: number;
}

export interface FilesObjectStore {
  signPut(input: {
    readonly key: string;
    readonly mimeType: FileMimeType;
    readonly byteSize: number;
  }): Promise<SignedUrl>;
  signGet(input: {
    readonly key: string;
    readonly mimeType: FileMimeType;
  }): Promise<SignedUrl>;
  headObject(key: string): Promise<{ readonly byteSize: number } | "missing">;
  getObject(key: string): Promise<ObjectBytes | "missing">;
  putObject(input: {
    readonly key: string;
    readonly mimeType: FileMimeType;
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

export function createFilesObjectStore(
  config: FilesS3Config,
): FilesObjectStore {
  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    // Garage/R2 reject the SDK's default CRC32 request checksums.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  const bucket = config.bucket;

  return {
    async signPut(input) {
      const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_SEC * 1000);
      try {
        const url = await getSignedUrl(
          client,
          new PutObjectCommand({
            Bucket: bucket,
            Key: input.key,
            ContentType: input.mimeType,
            ContentLength: input.byteSize,
          }),
          { expiresIn: SIGNED_URL_TTL_SEC },
        );
        return { url, expiresAt };
      } catch {
        throw new CoreInvariantError("files object store signPut failed");
      }
    },

    async signGet(input) {
      const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_SEC * 1000);
      const filename = downloadFilename(input.mimeType);
      try {
        const url = await getSignedUrl(
          client,
          new GetObjectCommand({
            Bucket: bucket,
            Key: input.key,
            ResponseContentType: input.mimeType,
            ResponseContentDisposition: `attachment; filename="${filename}"`,
          }),
          { expiresIn: SIGNED_URL_TTL_SEC },
        );
        return { url, expiresAt };
      } catch {
        throw new CoreInvariantError("files object store signGet failed");
      }
    },

    async headObject(key) {
      try {
        const result = await client.send(
          new HeadObjectCommand({ Bucket: bucket, Key: key }),
        );
        const byteSize = result.ContentLength;
        if (byteSize === undefined) {
          throw new CoreInvariantError(
            "files object store HeadObject omitted ContentLength",
          );
        }
        return { byteSize };
      } catch (error) {
        if (isMissingObject(error)) {
          return "missing";
        }
        throw new CoreInvariantError("files object store HeadObject failed");
      }
    },

    async getObject(key) {
      try {
        const result = await client.send(
          new GetObjectCommand({ Bucket: bucket, Key: key }),
        );
        const body = result.Body;
        if (body === undefined) {
          throw new CoreInvariantError(
            "files object store GetObject omitted Body",
          );
        }
        const bytes = await body.transformToByteArray();
        return { bytes, byteSize: bytes.byteLength };
      } catch (error) {
        if (isMissingObject(error)) {
          return "missing";
        }
        throw new CoreInvariantError("files object store GetObject failed");
      }
    },

    async putObject(input) {
      try {
        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: input.key,
            Body: input.bytes,
            ContentType: input.mimeType,
            ContentLength: input.bytes.byteLength,
          }),
        );
      } catch {
        throw new CoreInvariantError("files object store PutObject failed");
      }
    },

    async deleteObject(key) {
      try {
        await client.send(
          new DeleteObjectCommand({ Bucket: bucket, Key: key }),
        );
      } catch (error) {
        if (isMissingObject(error)) {
          return;
        }
        throw new CoreInvariantError("files object store DeleteObject failed");
      }
    },

    async probeBucket() {
      try {
        await client.send(new HeadBucketCommand({ Bucket: bucket }));
      } catch {
        throw new CoreInvariantError("files object store HeadBucket failed");
      }
    },

    close() {
      client.destroy();
    },
  };
}

function downloadFilename(mimeType: FileMimeType): string {
  switch (mimeType) {
    case "image/jpeg":
      return "catalog.jpg";
    case "image/png":
      return "catalog.png";
    case "image/webp":
      return "catalog.webp";
  }
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
