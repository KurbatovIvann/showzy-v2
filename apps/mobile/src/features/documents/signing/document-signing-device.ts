/**
 * Device I/O for QES (SHO-260). Kept out of the view-model so Vitest
 * covers the pipeline without Expo modules. Never log the key, password,
 * payload URL, or PUT URL.
 */
import { CryptoDigestAlgorithm, digest } from "expo-crypto";
import { getDocumentAsync } from "expo-document-picker";
import { File, Paths, UploadType } from "expo-file-system";

import { isAllowedSigningKeyName, signingKeyFileName } from "./signing-key";
import { sha256DigestToHex } from "./signing-checksum";
import { MAX_SIGNING_BYTES, SIGNING_MIME_TYPE } from "./signing-limits";
import { SigningAsicPackError } from "./signing-asic-pack";

export type PickedSigningKey =
  | { readonly kind: "canceled" }
  | { readonly kind: "invalid" }
  | {
      readonly kind: "picked";
      readonly fileName: string;
      readonly bytes: Uint8Array;
    };

export async function pickSigningKey(): Promise<PickedSigningKey> {
  const result = await getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || result.assets.length === 0) {
    return { kind: "canceled" };
  }
  const asset = result.assets[0];
  if (asset === undefined) {
    return { kind: "canceled" };
  }
  const fileName =
    signingKeyFileName(asset.name) ?? signingKeyFileName(asset.uri);
  if (fileName === null || !isAllowedSigningKeyName(fileName)) {
    return { kind: "invalid" };
  }
  const file = new File(asset.uri);
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (bytes.byteLength < 1 || bytes.byteLength > MAX_SIGNING_BYTES) {
    return { kind: "invalid" };
  }
  return { kind: "picked", fileName, bytes };
}

export async function downloadSigningPayload(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new TypeError("Failed to fetch");
  }
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (bytes.byteLength < 1 || bytes.byteLength > MAX_SIGNING_BYTES) {
    throw new SigningAsicPackError("payload");
  }
  return bytes;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const hashed = await digest(CryptoDigestAlgorithm.SHA256, copy);
  return sha256DigestToHex(hashed);
}

export async function putSigningAsic(args: {
  readonly bytes: Uint8Array;
  readonly uploadUrl: string;
  readonly mimeType: typeof SIGNING_MIME_TYPE;
  readonly signal: AbortSignal;
}): Promise<void> {
  const file = new File(
    Paths.cache,
    `document-signing-${String(Date.now())}.asice`,
  );
  file.write(args.bytes);
  try {
    const task = file.createUploadTask(args.uploadUrl, {
      httpMethod: "PUT",
      uploadType: UploadType.BINARY_CONTENT,
      headers: { "Content-Type": args.mimeType },
      mimeType: args.mimeType,
      sessionType: "foreground",
      signal: args.signal,
    });
    const result = await task.uploadAsync();
    if (result.status < 200 || result.status >= 300) {
      throw new TypeError("Failed to fetch");
    }
  } finally {
    try {
      if (file.exists) {
        file.delete();
      }
    } catch {
      // best effort — do not log the path
    }
  }
}
