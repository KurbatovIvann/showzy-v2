import sharp from "sharp";

import type { CatalogRendition } from "../wire.contract.js";

/** Long edge in pixels for each named rendition (SHO-244). */
export const CATALOG_RENDITION_LONG_EDGE = {
  thumb: 256,
  card: 640,
  hero: 1280,
  full: 2048,
} as const satisfies Record<CatalogRendition, number>;

/** WebP quality for catalog derivations. */
export const CATALOG_RENDITION_WEBP_QUALITY = 80;

/**
 * Decompression-bomb cap (~64 MP). Magic bytes do not bound decoded pixels.
 */
export const CATALOG_RENDITION_LIMIT_INPUT_PIXELS = 64_000_000;

export type CatalogRenditionBuffers = {
  readonly [K in CatalogRendition]: Uint8Array;
};

const insideWithoutUpscale = {
  fit: "inside",
  withoutEnlargement: true,
} as const;

type SharpPipeline = ReturnType<typeof sharp>;

/**
 * Bake EXIF orientation, strip metadata, and encode four long-edge WebPs.
 * Over-limit or undecodable input returns `"undecodable"` (finalize maps this
 * to the existing invalid-upload error and keeps the row pending).
 */
export async function encodeCatalogRenditions(
  bytes: Uint8Array,
): Promise<CatalogRenditionBuffers | "undecodable"> {
  try {
    const source = sharp(bytes, {
      limitInputPixels: CATALOG_RENDITION_LIMIT_INPUT_PIXELS,
      failOn: "error",
    }).rotate();

    const [thumb, card, hero, full] = await Promise.all([
      resizeWebp(source, CATALOG_RENDITION_LONG_EDGE.thumb),
      resizeWebp(source, CATALOG_RENDITION_LONG_EDGE.card),
      resizeWebp(source, CATALOG_RENDITION_LONG_EDGE.hero),
      resizeWebp(source, CATALOG_RENDITION_LONG_EDGE.full),
    ]);
    return { thumb, card, hero, full };
  } catch {
    return "undecodable";
  }
}

async function resizeWebp(
  source: SharpPipeline,
  longEdge: number,
): Promise<Uint8Array> {
  const buffer = await source
    .clone()
    .resize(longEdge, longEdge, insideWithoutUpscale)
    .webp({ quality: CATALOG_RENDITION_WEBP_QUALITY })
    .toBuffer();
  return new Uint8Array(buffer);
}
