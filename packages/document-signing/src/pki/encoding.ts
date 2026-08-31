/**
 * Base64/hex primitives on the signing hot path. `docSigning.complete`
 * encodes up-to-25 MiB ASiC payloads inside its DB transaction (SHO-282),
 * so Node uses `Buffer` directly; web/native fall back to chunked
 * `String.fromCharCode` + `btoa`/`atob` instead of per-byte string
 * concatenation.
 */

/** Keeps `String.fromCharCode(...chunk)` far below engine argument limits. */
const CHUNK_SIZE = 0x8000;

type Base64Buffer = Uint8Array & { toString(encoding: "base64"): string };

interface NodeBufferCtor {
  from(data: ArrayBufferLike, byteOffset: number, length: number): Base64Buffer;
  from(data: string, encoding: "base64"): Base64Buffer;
}

/**
 * Node's `Buffer`, when the runtime provides it. Typed locally so this
 * file also compiles in web/native tsconfigs without `@types/node`.
 */
function nodeBuffer(): NodeBufferCtor | undefined {
  const candidate = (globalThis as { Buffer?: NodeBufferCtor }).Buffer;
  return typeof candidate === "function" ? candidate : undefined;
}

/** Fallback for runtimes without `Buffer` (web worker, React Native). */
export function uint8ToBase64Chunked(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    parts.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE)));
  }
  return btoa(parts.join(""));
}

/** Fallback for runtimes without `Buffer` (web worker, React Native). */
export function base64ToUint8Chunked(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function uint8ToBase64(bytes: Uint8Array): string {
  const bufferCtor = nodeBuffer();
  if (bufferCtor !== undefined) {
    return bufferCtor
      .from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      .toString("base64");
  }
  return uint8ToBase64Chunked(bytes);
}

export function base64ToUint8(b64: string): Uint8Array {
  const bufferCtor = nodeBuffer();
  if (bufferCtor !== undefined) {
    const decoded = bufferCtor.from(b64, "base64");
    return new Uint8Array(
      decoded.buffer,
      decoded.byteOffset,
      decoded.byteLength,
    );
  }
  return base64ToUint8Chunked(b64);
}

export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

export function leU32(buf: Uint8Array, offset: number): number {
  return (
    (buf[offset] ?? 0) |
    ((buf[offset + 1] ?? 0) << 8) |
    ((buf[offset + 2] ?? 0) << 16) |
    ((buf[offset + 3] ?? 0) << 24)
  );
}
