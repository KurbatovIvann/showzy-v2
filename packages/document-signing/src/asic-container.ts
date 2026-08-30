/**
 * ASiC-E is a ZIP. This packer/unpacker is STORED-only (no deflate) so
 * the mandatory first `mimetype` entry stays uncompressed with an empty
 * extra field (ETSI TS 102 918). It does not reimplement UAPKI.
 */
import { crc32 } from "node:zlib";

import { AsicContainerError } from "./errors.js";

export const ASIC_E_MIMETYPE = "application/vnd.etsi.asic-e+zip";

const LOCAL_SIG = 0x04034b50;
const CENTRAL_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;
const STORED = 0;
const ZIP_VERSION = 20;

export type AsicEntry = {
  readonly name: string;
  readonly bytes: Uint8Array;
};

export type UnpackedAsic = {
  readonly entries: readonly AsicEntry[];
  readonly payload: AsicEntry;
  readonly manifest: AsicEntry;
  readonly signature: AsicEntry;
};

function concat(parts: readonly Uint8Array[]): Uint8Array {
  let total = 0;
  for (const part of parts) {
    total += part.byteLength;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}

function u16(value: number): Uint8Array {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}

function u32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, true);
  return bytes;
}

function readU16(bytes: Uint8Array, offset: number): number {
  if (offset + 2 > bytes.byteLength) {
    throw new AsicContainerError("ASiC ZIP truncated at u16");
  }
  return new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  ).getUint16(offset, true);
}

function readU32(bytes: Uint8Array, offset: number): number {
  if (offset + 4 > bytes.byteLength) {
    throw new AsicContainerError("ASiC ZIP truncated at u32");
  }
  return new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  ).getUint32(offset, true);
}

function encodeName(name: string): Uint8Array {
  return new TextEncoder().encode(name);
}

function decodeName(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function crcOf(bytes: Uint8Array): number {
  return crc32(bytes) >>> 0;
}

function requireMimetypeFirst(entries: readonly AsicEntry[]): AsicEntry[] {
  const mimetypeIndex = entries.findIndex((entry) => entry.name === "mimetype");
  if (mimetypeIndex < 0) {
    throw new AsicContainerError("ASiC-E requires a mimetype file");
  }
  const mimetype = entries[mimetypeIndex];
  if (mimetype === undefined) {
    throw new AsicContainerError("ASiC-E requires a mimetype file");
  }
  const declared = new TextDecoder().decode(mimetype.bytes);
  if (declared !== ASIC_E_MIMETYPE) {
    throw new AsicContainerError(
      "ASiC-E mimetype file is not application/vnd.etsi.asic-e+zip",
    );
  }
  const rest = entries.filter((_, index) => index !== mimetypeIndex);
  return [mimetype, ...rest];
}

export function packAsicE(entries: readonly AsicEntry[]): Uint8Array {
  const ordered = requireMimetypeFirst(entries);
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const entry of ordered) {
    const nameBytes = encodeName(entry.name);
    const crc = crcOf(entry.bytes);
    const size = entry.bytes.byteLength;
    const local = concat([
      u32(LOCAL_SIG),
      u16(ZIP_VERSION),
      u16(0),
      u16(STORED),
      u16(0),
      u16(0),
      u32(crc),
      u32(size),
      u32(size),
      u16(nameBytes.byteLength),
      u16(0),
      nameBytes,
      entry.bytes,
    ]);
    const central = concat([
      u32(CENTRAL_SIG),
      u16(ZIP_VERSION),
      u16(ZIP_VERSION),
      u16(0),
      u16(STORED),
      u16(0),
      u16(0),
      u32(crc),
      u32(size),
      u32(size),
      u16(nameBytes.byteLength),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBytes,
    ]);
    locals.push(local);
    centrals.push(central);
    offset += local.byteLength;
  }

  const centralDir = concat(centrals);
  const eocd = concat([
    u32(EOCD_SIG),
    u16(0),
    u16(0),
    u16(ordered.length),
    u16(ordered.length),
    u32(centralDir.byteLength),
    u32(offset),
    u16(0),
  ]);
  return concat([...locals, centralDir, eocd]);
}

function findEocd(bytes: Uint8Array): number {
  const min = Math.max(0, bytes.byteLength - 22 - 65535);
  for (let i = bytes.byteLength - 22; i >= min; i -= 1) {
    if (readU32(bytes, i) === EOCD_SIG) {
      return i;
    }
  }
  throw new AsicContainerError(
    "ASiC ZIP is missing the end-of-central-directory",
  );
}

function parseCentralEntries(bytes: Uint8Array): AsicEntry[] {
  const eocd = findEocd(bytes);
  const entryCount = readU16(bytes, eocd + 10);
  const cdSize = readU32(bytes, eocd + 12);
  const cdOffset = readU32(bytes, eocd + 16);
  if (cdOffset + cdSize > bytes.byteLength) {
    throw new AsicContainerError("ASiC ZIP central directory is truncated");
  }

  const entries: AsicEntry[] = [];
  let cursor = cdOffset;
  for (let i = 0; i < entryCount; i += 1) {
    if (readU32(bytes, cursor) !== CENTRAL_SIG) {
      throw new AsicContainerError("ASiC ZIP central directory is corrupt");
    }
    const flags = readU16(bytes, cursor + 8);
    const method = readU16(bytes, cursor + 10);
    const compressed = readU32(bytes, cursor + 20);
    const uncompressed = readU32(bytes, cursor + 24);
    const nameLen = readU16(bytes, cursor + 28);
    const extraLen = readU16(bytes, cursor + 30);
    const commentLen = readU16(bytes, cursor + 32);
    const localOffset = readU32(bytes, cursor + 42);
    const name = decodeName(bytes.subarray(cursor + 46, cursor + 46 + nameLen));
    if ((flags & 0x08) !== 0) {
      throw new AsicContainerError(
        "ASiC ZIP data descriptors are not supported",
      );
    }
    if (method !== STORED) {
      throw new AsicContainerError(
        "ASiC ZIP entries must be stored uncompressed",
      );
    }
    if (compressed !== uncompressed) {
      throw new AsicContainerError("ASiC ZIP stored size mismatch");
    }
    if (readU32(bytes, localOffset) !== LOCAL_SIG) {
      throw new AsicContainerError("ASiC ZIP local header is corrupt");
    }
    const localNameLen = readU16(bytes, localOffset + 26);
    const localExtraLen = readU16(bytes, localOffset + 28);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const dataEnd = dataStart + uncompressed;
    if (dataEnd > bytes.byteLength) {
      throw new AsicContainerError("ASiC ZIP file data is truncated");
    }
    entries.push({ name, bytes: bytes.subarray(dataStart, dataEnd) });
    cursor += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function isManifestName(name: string): boolean {
  return /^META-INF\/ASiCManifest\d+\.xml$/i.test(name);
}

function isSignatureName(name: string): boolean {
  return /^META-INF\/signatures?\d+\.p7s$/i.test(name);
}

function payloadUriFromManifest(manifestXml: string): string | undefined {
  const match = /<asic:DataObjectReference\b[^>]*\bURI="([^"]+)"/i.exec(
    manifestXml,
  );
  if (match === null || match[1] === undefined) {
    return undefined;
  }
  return match[1].replace(/^\//, "");
}

export function unpackAsicE(bytes: Uint8Array): UnpackedAsic {
  if (bytes.byteLength < 4 || readU32(bytes, 0) !== LOCAL_SIG) {
    throw new AsicContainerError("Bytes are not a ZIP/ASiC container");
  }
  const entries = requireMimetypeFirst(parseCentralEntries(bytes));
  const first = entries[0];
  if (first === undefined || first.name !== "mimetype") {
    throw new AsicContainerError("ASiC-E mimetype must be the first ZIP entry");
  }
  const manifest = entries.find((entry) => isManifestName(entry.name));
  const signature = entries.find((entry) => isSignatureName(entry.name));
  if (manifest === undefined || signature === undefined) {
    throw new AsicContainerError(
      "ASiC-E requires META-INF/ASiCManifest*.xml and META-INF/signature*.p7s",
    );
  }
  const xml = new TextDecoder().decode(manifest.bytes);
  const uri = payloadUriFromManifest(xml);
  const payload =
    uri !== undefined
      ? entries.find((entry) => entry.name === uri)
      : entries.find(
          (entry) =>
            entry.name !== "mimetype" && !entry.name.startsWith("META-INF/"),
        );
  if (payload === undefined) {
    throw new AsicContainerError("ASiC-E is missing the signed payload file");
  }
  return { entries, payload, manifest, signature };
}
