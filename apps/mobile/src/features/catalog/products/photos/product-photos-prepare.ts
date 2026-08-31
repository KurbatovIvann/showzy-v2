/**
 * Catalog image strategy and compress planning (SHO-303). Native I/O
 * stays in `product-photos-native.ts`.
 */
import {
  MAX_UPLOAD_BYTES,
  PHOTO_MAX_EDGE,
  PHOTO_MIN_COMPRESS,
  PHOTO_MIN_EDGE,
} from "./product-photos-limits";

export type CatalogImageStrategy =
  "keep-jpeg" | "keep-png" | "keep-webp" | "convert-jpeg";

export type CatalogImagePreparePlan =
  { readonly kind: "keep" } | { readonly kind: "compress" };

export type PhotoCompressPlan =
  | { readonly kind: "ok" }
  | { readonly kind: "again"; readonly edge: number; readonly compress: number }
  | { readonly kind: "fail" };

export function catalogImageStrategy(
  mimeType: string | undefined,
  fileName: string | undefined,
): CatalogImageStrategy {
  const mime = (mimeType ?? "").toLowerCase();
  const name = (fileName ?? "").toLowerCase();
  if (mime === "image/jpeg" || mime === "image/jpg") {
    return "keep-jpeg";
  }
  if (mime === "image/png") {
    return "keep-png";
  }
  if (mime === "image/webp") {
    return "keep-webp";
  }
  if (
    mime === "image/heic" ||
    mime === "image/heif" ||
    name.endsWith(".heic") ||
    name.endsWith(".heif")
  ) {
    return "convert-jpeg";
  }
  if (name.endsWith(".png")) {
    return "keep-png";
  }
  if (name.endsWith(".webp")) {
    return "keep-webp";
  }
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) {
    return "keep-jpeg";
  }
  return "convert-jpeg";
}

/**
 * JPEG/PNG/WebP stay as-is only when already in-cap and ≤ PHOTO_MAX_EDGE.
 * Size ≤ 10 MiB is not enough — camera JPEGs are 3–8 MiB at 4032px.
 * HEIC / unknown always convert (SHO-245).
 */
export function catalogImagePreparePlan(args: {
  readonly strategy: CatalogImageStrategy;
  readonly byteSize: number;
  readonly longEdge: number;
}): CatalogImagePreparePlan {
  if (args.strategy === "convert-jpeg") {
    return { kind: "compress" };
  }
  if (args.byteSize < 1 || args.byteSize > MAX_UPLOAD_BYTES) {
    return { kind: "compress" };
  }
  if (args.longEdge > PHOTO_MAX_EDGE) {
    return { kind: "compress" };
  }
  return { kind: "keep" };
}

export function nextPhotoCompressPlan(args: {
  readonly byteSize: number;
  readonly edge: number;
  readonly compress: number;
}): PhotoCompressPlan {
  if (args.byteSize >= 1 && args.byteSize <= MAX_UPLOAD_BYTES) {
    return { kind: "ok" };
  }
  const atFloor =
    args.edge <= PHOTO_MIN_EDGE && args.compress <= PHOTO_MIN_COMPRESS;
  if (atFloor) {
    return { kind: "fail" };
  }
  return {
    kind: "again",
    edge: Math.max(PHOTO_MIN_EDGE, Math.floor(args.edge * 0.75)),
    compress: Math.max(PHOTO_MIN_COMPRESS, roundCompress(args.compress - 0.14)),
  };
}

function roundCompress(value: number): number {
  return Math.round(value * 100) / 100;
}
