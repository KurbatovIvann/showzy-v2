import { crc32, deflateRawSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { ASIC_E_MIMETYPE, packAsicE, unpackAsicE } from "./asic-container.js";
import { AsicContainerError } from "./errors.js";

const encoder = new TextEncoder();
const LOCAL_SIG = 0x04034b50;
const CENTRAL_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;
const STORED = 0;
const DEFLATE = 8;

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

function packZip(
  entries: readonly {
    readonly name: string;
    readonly bytes: Uint8Array;
    readonly method: 0 | 8;
  }[],
): Uint8Array {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const crc = crc32(entry.bytes) >>> 0;
    const uncompressed = entry.bytes.byteLength;
    const payload =
      entry.method === DEFLATE
        ? new Uint8Array(deflateRawSync(entry.bytes))
        : entry.bytes;
    const compressed = payload.byteLength;
    const local = concat([
      u32(LOCAL_SIG),
      u16(20),
      u16(0),
      u16(entry.method),
      u16(0),
      u16(0),
      u32(crc),
      u32(compressed),
      u32(uncompressed),
      u16(nameBytes.byteLength),
      u16(0),
      nameBytes,
      payload,
    ]);
    const central = concat([
      u32(CENTRAL_SIG),
      u16(20),
      u16(20),
      u16(0),
      u16(entry.method),
      u16(0),
      u16(0),
      u32(crc),
      u32(compressed),
      u32(uncompressed),
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
    u16(entries.length),
    u16(entries.length),
    u32(centralDir.byteLength),
    u32(offset),
    u16(0),
  ]);
  return concat([...locals, centralDir, eocd]);
}

const asicParts = {
  mimetype: encoder.encode(ASIC_E_MIMETYPE),
  payload: encoder.encode("%PDF-1.4\n%%EOF\n"),
  manifest: encoder.encode(
    '<asic:ASiCManifest><asic:DataObjectReference URI="document.pdf"/></asic:ASiCManifest>',
  ),
  signature: encoder.encode("p7s-bytes"),
};

describe("ASiC-E pack/unpack", () => {
  it("round-trips mimetype-first stored entries", () => {
    const packed = packAsicE([
      { name: "document.pdf", bytes: asicParts.payload },
      { name: "mimetype", bytes: asicParts.mimetype },
      { name: "META-INF/ASiCManifest001.xml", bytes: asicParts.manifest },
      { name: "META-INF/signature001.p7s", bytes: asicParts.signature },
    ]);
    expect(packed[0]).toBe(0x50);
    expect(packed[1]).toBe(0x4b);
    const unpacked = unpackAsicE(packed);
    expect(unpacked.entries[0]?.name).toBe("mimetype");
    expect(
      new TextDecoder().decode(unpacked.entries[0]?.bytes ?? new Uint8Array()),
    ).toBe(ASIC_E_MIMETYPE);
    expect(unpacked.payload.name).toBe("document.pdf");
    expect(
      Buffer.from(unpacked.payload.bytes).equals(
        Buffer.from(asicParts.payload),
      ),
    ).toBe(true);
    expect(unpacked.manifest.name).toBe("META-INF/ASiCManifest001.xml");
    expect(unpacked.signature.name).toBe("META-INF/signature001.p7s");
  });

  it("inflates DEFLATE (method 8) on non-mimetype entries", () => {
    const packed = packZip([
      { name: "mimetype", bytes: asicParts.mimetype, method: STORED },
      { name: "document.pdf", bytes: asicParts.payload, method: DEFLATE },
      {
        name: "META-INF/ASiCManifest001.xml",
        bytes: asicParts.manifest,
        method: DEFLATE,
      },
      {
        name: "META-INF/signature001.p7s",
        bytes: asicParts.signature,
        method: DEFLATE,
      },
    ]);
    const unpacked = unpackAsicE(packed);
    expect(unpacked.entries[0]?.name).toBe("mimetype");
    expect(
      Buffer.from(unpacked.payload.bytes).equals(
        Buffer.from(asicParts.payload),
      ),
    ).toBe(true);
    expect(
      Buffer.from(unpacked.manifest.bytes).equals(
        Buffer.from(asicParts.manifest),
      ),
    ).toBe(true);
    expect(
      Buffer.from(unpacked.signature.bytes).equals(
        Buffer.from(asicParts.signature),
      ),
    ).toBe(true);
  });

  it("rejects a container whose first on-disk local header is not mimetype", () => {
    const packed = packZip([
      { name: "document.pdf", bytes: asicParts.payload, method: STORED },
      { name: "mimetype", bytes: asicParts.mimetype, method: STORED },
      {
        name: "META-INF/ASiCManifest001.xml",
        bytes: asicParts.manifest,
        method: STORED,
      },
      {
        name: "META-INF/signature001.p7s",
        bytes: asicParts.signature,
        method: STORED,
      },
    ]);
    expect(() => unpackAsicE(packed)).toThrow(AsicContainerError);
    expect(() => unpackAsicE(packed)).toThrow(/mimetype must be the first/);
  });

  it("rejects a ZIP that is not ASiC-E", () => {
    const packed = packAsicE([
      { name: "mimetype", bytes: encoder.encode(ASIC_E_MIMETYPE) },
      { name: "note.txt", bytes: encoder.encode("hi") },
    ]);
    expect(() => unpackAsicE(packed)).toThrow(AsicContainerError);
    expect(() => unpackAsicE(encoder.encode("not-a-zip"))).toThrow(
      AsicContainerError,
    );
  });
});
