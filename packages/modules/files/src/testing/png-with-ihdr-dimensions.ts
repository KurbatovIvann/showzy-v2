import { crc32, deflateSync } from "node:zlib";

const PNG_SIGNATURE = Uint8Array.of(
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
);

/**
 * PNG whose IHDR claims `width`×`height` without a decoded raster.
 * IDAT is a 1-pixel scanline so sharp `limitInputPixels` can reject from
 * the header. Test fixture — not a module export.
 */
export function pngWithIhdrDimensions(
  width: number,
  height: number,
): Uint8Array {
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = new Uint8Array(deflateSync(Uint8Array.of(0, 0, 0, 0)));
  const ihdrChunk = pngChunk("IHDR", ihdr);
  const idatChunk = pngChunk("IDAT", idat);
  const iendChunk = pngChunk("IEND", new Uint8Array(0));
  const bytes = new Uint8Array(
    PNG_SIGNATURE.length +
      ihdrChunk.length +
      idatChunk.length +
      iendChunk.length,
  );
  let offset = 0;
  bytes.set(PNG_SIGNATURE, offset);
  offset += PNG_SIGNATURE.length;
  bytes.set(ihdrChunk, offset);
  offset += ihdrChunk.length;
  bytes.set(idatChunk, offset);
  offset += idatChunk.length;
  bytes.set(iendChunk, offset);
  return bytes;
}

export function pngIhdrDimensions(bytes: Uint8Array): {
  readonly width: number;
  readonly height: number;
} {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    width: view.getUint32(16),
    height: view.getUint32(20),
  };
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const payload = new Uint8Array(typeBytes.length + data.length);
  payload.set(typeBytes, 0);
  payload.set(data, typeBytes.length);
  const checksum = crc32(payload);
  const chunk = new Uint8Array(4 + payload.length + 4);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  chunk.set(payload, 4);
  view.setUint32(4 + payload.length, checksum);
  return chunk;
}
