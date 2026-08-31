/**
 * Photo failure → banner-key mapping (SHO-303). Pure copy keys, never
 * user-facing text.
 */
import type { QueryFailureKind } from "../../../../api/errors";
import type { ProductsPhotosCopy } from "../../../../i18n/products";
import type { UploadFailureKind } from "./product-photos-upload";

export type PhotoBannerKey =
  | "network"
  | "offline"
  | "unavailable"
  | "permission"
  | "denied"
  | "validation"
  | "too_many"
  | "commit";

export function mapDeniedBanner(
  source: "camera" | "library" | null,
): PhotoBannerKey | null {
  return source === null ? null : "denied";
}

export function mapPhotoFailure(
  kind: QueryFailureKind | null,
): PhotoBannerKey | null {
  if (kind === null) {
    return null;
  }
  if (kind === "permission") {
    return "permission";
  }
  if (kind === "validation") {
    return "validation";
  }
  if (kind === "network") {
    return "network";
  }
  if (kind === "offline") {
    return "offline";
  }
  return "unavailable";
}

export function mapUploadBanner(
  reason: UploadFailureKind | null,
): PhotoBannerKey | null {
  if (reason === null) {
    return null;
  }
  if (reason === "permission") {
    return "permission";
  }
  if (reason === "validation") {
    return "validation";
  }
  if (reason === "network") {
    return "network";
  }
  if (reason === "offline") {
    return "offline";
  }
  return "unavailable";
}

export function resolvePhotoBanner(
  copy: ProductsPhotosCopy,
  key: PhotoBannerKey | null,
): string | null {
  if (key === null) {
    return null;
  }
  return copy.errors[key];
}

/**
 * Photo-strip banner precedence: local session, then commit mutation,
 * then `files.getDownloadUrls` (never treat a download error as success
 * with empty preview URLs).
 */
export function resolveProductPhotosBannerKey(args: {
  readonly localBanner: PhotoBannerKey | null;
  readonly mutationFailure: QueryFailureKind | null;
  readonly downloadFailure: QueryFailureKind | null;
}): PhotoBannerKey | null {
  if (args.localBanner !== null) {
    return args.localBanner;
  }
  const mutationBanner = mapPhotoFailure(args.mutationFailure);
  if (mutationBanner !== null) {
    return mutationBanner;
  }
  if (args.mutationFailure !== null) {
    return "commit";
  }
  return mapPhotoFailure(args.downloadFailure);
}
