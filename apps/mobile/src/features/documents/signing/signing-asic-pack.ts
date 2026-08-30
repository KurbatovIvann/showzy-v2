/**
 * STORED-only ASiC-E packer for React Native (SHO-260).
 *
 * `packages/document-signing` `asic-container.ts` imports `node:zlib`
 * (CRC + inflate) and cannot run in Hermes. This copy packs the same
 * ETSI layout: first `mimetype` uncompressed, empty extra field, then
 * payload + manifest + detached CAdES. It does not inflate or verify.
 */
import {
  ASIC_MANIFEST_NAME,
  ASIC_SIGNATURE_NAME,
  MAX_SIGNING_BYTES,
  SIGNING_MIME_TYPE,
  SIGNING_PAYLOAD_NAME,
} from "./signing-limits";

const LOCAL_SIG = 0x04034b50;
const CENTRAL_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;
const STORED = 0;
const ZIP_VERSION = 20;

const CRC_TABLE = buildCrcTable();

export type AsicPackEntry = {
  readonly name: string;
  readonly bytes: Uint8Array;
};

export class SigningAsicPackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SigningAsicPackError";
  }
}

function buildCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let crc = i;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) !== 0 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
    table[i] = crc >>> 0;
  }
  return table;
}

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    const index = (crc ^ byte) & 0xff;
    const row = CRC_TABLE[index];
    if (row === undefined) {
      throw new SigningAsicPackError("CRC table is corrupt");
    }
    crc = row ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

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

function encodeName(name: string): Uint8Array {
  return new TextEncoder().encode(name);
}

/**
 * ASiCManifest XML whose DigestValue is the GOST/Kupyna digest of the
 * PDF (not SHA-256). The CAdES is of this XML, not of the payload.
 */
export function buildAsicManifestXml(args: {
  readonly payloadName: string;
  readonly digestUri: string;
  readonly digestB64: string;
}): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<asic:ASiCManifest xmlns:asic="http://uri.etsi.org/02918/v1.2.1#" xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
  <asic:SigReference URI="${ASIC_SIGNATURE_NAME}" MimeType="application/x-pkcs7-signature"/>
  <asic:DataObjectReference URI="${args.payloadName}" MimeType="application/pdf">
    <ds:DigestMethod Algorithm="${args.digestUri}"/>
    <ds:DigestValue>${args.digestB64}</ds:DigestValue>
  </asic:DataObjectReference>
</asic:ASiCManifest>
`;
}

export function packStoredAsicE(entries: readonly AsicPackEntry[]): Uint8Array {
  const mimetypeIndex = entries.findIndex((entry) => entry.name === "mimetype");
  if (mimetypeIndex < 0) {
    throw new SigningAsicPackError("ASiC-E requires a mimetype file");
  }
  const mimetype = entries[mimetypeIndex];
  if (mimetype === undefined) {
    throw new SigningAsicPackError("ASiC-E requires a mimetype file");
  }
  const declared = new TextDecoder().decode(mimetype.bytes);
  if (declared !== SIGNING_MIME_TYPE) {
    throw new SigningAsicPackError(
      "ASiC-E mimetype file is not application/vnd.etsi.asic-e+zip",
    );
  }
  const rest = entries.filter((_, index) => index !== mimetypeIndex);
  const ordered = [mimetype, ...rest];
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  let total = 0;

  for (const entry of ordered) {
    total += entry.bytes.byteLength;
    if (total > MAX_SIGNING_BYTES) {
      throw new SigningAsicPackError("ASiC-E exceeds the 25 MiB budget");
    }
    const nameBytes = encodeName(entry.name);
    const crc = crc32(entry.bytes);
    const size = entry.bytes.byteLength;
    const extraLen = entry.name === "mimetype" ? 0 : 0;
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
      u16(extraLen),
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
  const packed = concat([...locals, centralDir, eocd]);
  if (packed.byteLength > MAX_SIGNING_BYTES) {
    throw new SigningAsicPackError("ASiC-E exceeds the 25 MiB budget");
  }
  return packed;
}

export function packSignedAsicE(args: {
  readonly payload: Uint8Array;
  readonly digestUri: string;
  readonly digestB64: string;
  readonly signature: Uint8Array;
}): Uint8Array {
  const manifest = new TextEncoder().encode(
    buildAsicManifestXml({
      payloadName: SIGNING_PAYLOAD_NAME,
      digestUri: args.digestUri,
      digestB64: args.digestB64,
    }),
  );
  return packStoredAsicE([
    {
      name: "mimetype",
      bytes: new TextEncoder().encode(SIGNING_MIME_TYPE),
    },
    { name: SIGNING_PAYLOAD_NAME, bytes: args.payload },
    { name: ASIC_MANIFEST_NAME, bytes: manifest },
    { name: ASIC_SIGNATURE_NAME, bytes: args.signature },
  ]);
}
