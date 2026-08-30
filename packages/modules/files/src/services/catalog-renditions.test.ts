import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { CATALOG_RENDITIONS } from "../wire.contract.js";
import {
  CATALOG_RENDITION_LIMIT_INPUT_PIXELS,
  CATALOG_RENDITION_LONG_EDGE,
  encodeCatalogRenditions,
} from "./catalog-renditions.js";

async function solidJpeg(input: {
  readonly width: number;
  readonly height: number;
  readonly orientation?: number;
}): Promise<Uint8Array> {
  let pipeline = sharp({
    create: {
      width: input.width,
      height: input.height,
      channels: 3,
      background: { r: 40, g: 120, b: 200 },
    },
  }).jpeg({ quality: 80 });
  if (input.orientation !== undefined) {
    pipeline = pipeline.withMetadata({ orientation: input.orientation });
  }
  return new Uint8Array(await pipeline.toBuffer());
}

async function longEdge(bytes: Uint8Array): Promise<number> {
  const meta = await sharp(bytes).metadata();
  return Math.max(meta.width, meta.height);
}

describe("encodeCatalogRenditions", () => {
  it("writes four WebP buffers and strips EXIF from an orientation-6 JPEG", async () => {
    const source = await solidJpeg({
      width: 100,
      height: 40,
      orientation: 6,
    });
    const before = await sharp(source).metadata();
    expect(before.orientation).toBe(6);
    expect(before.exif).toBeInstanceOf(Buffer);

    const encoded = await encodeCatalogRenditions(source);
    expect(encoded).not.toBe("undecodable");
    if (encoded === "undecodable") {
      throw new Error("expected decoded renditions");
    }

    for (const rendition of CATALOG_RENDITIONS) {
      const bytes = encoded[rendition];
      const meta = await sharp(bytes).metadata();
      expect(meta.format).toBe("webp");
      expect(meta.exif).toBeUndefined();
      expect(meta.icc).toBeUndefined();
      expect(meta.iptc).toBeUndefined();
      expect(meta.xmp).toBeUndefined();
      expect(meta.orientation).toBeUndefined();
      expect(meta.width).toBe(40);
      expect(meta.height).toBe(100);
    }
  });

  it("does not upscale a 720px original and still yields all four renditions", async () => {
    const source = await solidJpeg({ width: 720, height: 400 });
    const encoded = await encodeCatalogRenditions(source);
    expect(encoded).not.toBe("undecodable");
    if (encoded === "undecodable") {
      throw new Error("expected decoded renditions");
    }

    expect(await longEdge(encoded.thumb)).toBe(
      CATALOG_RENDITION_LONG_EDGE.thumb,
    );
    expect(await longEdge(encoded.card)).toBe(CATALOG_RENDITION_LONG_EDGE.card);
    expect(await longEdge(encoded.hero)).toBe(720);
    expect(await longEdge(encoded.full)).toBe(720);
  });

  it("rejects an oversized-pixel PNG under the decompression-bomb cap", async () => {
    const over = 8001;
    expect(over * over).toBeGreaterThan(CATALOG_RENDITION_LIMIT_INPUT_PIXELS);
    const bomb = new Uint8Array(
      await sharp({
        create: {
          width: over,
          height: over,
          channels: 3,
          background: { r: 0, g: 0, b: 0 },
        },
      })
        .png({ compressionLevel: 9 })
        .toBuffer(),
    );
    expect(bomb[0]).toBe(0x89);
    expect(bomb[1]).toBe(0x50);

    const encoded = await encodeCatalogRenditions(bomb);
    expect(encoded).toBe("undecodable");
  });

  it("rejects undecodable JPEG magic that is not a real image", async () => {
    const stub = Uint8Array.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
    ]);
    expect(await encodeCatalogRenditions(stub)).toBe("undecodable");
  });
});
