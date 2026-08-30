import type { FileMimeType } from "../wire.contract.js";

const JPEG_MAGIC = [0xff, 0xd8, 0xff] as const;
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const HEIC_BRANDS = new Set([
  "heic",
  "heif",
  "mif1",
  "msf1",
  "heix",
  "hevc",
  "hevx",
]);

function startsWith(bytes: Uint8Array, magic: readonly number[]): boolean {
  if (bytes.length < magic.length) {
    return false;
  }
  return magic.every((value, index) => bytes[index] === value);
}

function asciiAt(bytes: Uint8Array, offset: number, length: number): string {
  if (bytes.length < offset + length) {
    return "";
  }
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function isWebp(bytes: Uint8Array): boolean {
  return asciiAt(bytes, 0, 4) === "RIFF" && asciiAt(bytes, 8, 4) === "WEBP";
}

function isHeicFamily(bytes: Uint8Array): boolean {
  if (asciiAt(bytes, 4, 4) !== "ftyp") {
    return false;
  }
  return HEIC_BRANDS.has(asciiAt(bytes, 8, 4));
}

function isZipContainer(bytes: Uint8Array): boolean {
  return (
    startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) ||
    startsWith(bytes, [0x50, 0x4b, 0x05, 0x06]) ||
    startsWith(bytes, [0x50, 0x4b, 0x07, 0x08])
  );
}

function isNonZipExecutableOrArchive(bytes: Uint8Array): boolean {
  return (
    startsWith(bytes, [0x4d, 0x5a]) ||
    startsWith(bytes, [0x7f, 0x45, 0x4c, 0x46]) ||
    startsWith(bytes, [0xfe, 0xed, 0xfa, 0xce]) ||
    startsWith(bytes, [0xce, 0xfa, 0xed, 0xfe]) ||
    startsWith(bytes, [0xfe, 0xed, 0xfa, 0xcf]) ||
    startsWith(bytes, [0xcf, 0xfa, 0xed, 0xfe]) ||
    startsWith(bytes, [0x23, 0x21]) ||
    startsWith(bytes, [0x00, 0x61, 0x73, 0x6d]) ||
    startsWith(bytes, [0x52, 0x61, 0x72, 0x21]) ||
    startsWith(bytes, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]) ||
    startsWith(bytes, [0x1f, 0x8b]) ||
    startsWith(bytes, [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00]) ||
    startsWith(bytes, [0x42, 0x5a, 0x68])
  );
}

function isExecutableOrArchive(bytes: Uint8Array): boolean {
  return isNonZipExecutableOrArchive(bytes) || isZipContainer(bytes);
}

export function detectAllowedImageMime(
  bytes: Uint8Array,
): FileMimeType | undefined {
  if (startsWith(bytes, JPEG_MAGIC)) {
    return "image/jpeg";
  }
  if (startsWith(bytes, PNG_MAGIC)) {
    return "image/png";
  }
  if (isWebp(bytes)) {
    return "image/webp";
  }
  return undefined;
}

/**
 * True when the bytes are an allowed image matching `declaredMime`.
 * Executables, archives, HEIC, and MIME/magic mismatches are rejected.
 */
export function uploadBytesMatchDeclaredMime(
  bytes: Uint8Array,
  declaredMime: FileMimeType,
): boolean {
  if (isExecutableOrArchive(bytes) || isHeicFamily(bytes)) {
    return false;
  }
  return detectAllowedImageMime(bytes) === declaredMime;
}

function isPdf(bytes: Uint8Array): boolean {
  return asciiAt(bytes, 0, 4) === "%PDF";
}

/**
 * True when the bytes are a PDF (generated-document path). Catalog
 * handshake still uses `uploadBytesMatchDeclaredMime` only.
 */
export function bytesArePdf(bytes: Uint8Array): boolean {
  if (isExecutableOrArchive(bytes) || isHeicFamily(bytes)) {
    return false;
  }
  return isPdf(bytes);
}

/**
 * True when the bytes are a ZIP container (ASiC-E is a ZIP). Catalog and
 * document paths still deny archives. Full ASiC verify (mimetype file /
 * package vectors) is `docSigning.complete` (SHO-258).
 */
export function bytesAreAsicContainer(bytes: Uint8Array): boolean {
  if (isNonZipExecutableOrArchive(bytes) || isHeicFamily(bytes)) {
    return false;
  }
  return isZipContainer(bytes);
}
