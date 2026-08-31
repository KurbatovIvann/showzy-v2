/**
 * Device I/O for product photo attach (SHO-141). Kept out of the
 * view-model so Vitest can cover the handshake without Expo modules.
 */
import { digest, CryptoDigestAlgorithm } from "expo-crypto";
import { File, UploadType } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import {
  launchCameraAsync,
  launchImageLibraryAsync,
  PermissionStatus,
  requestCameraPermissionsAsync,
  requestMediaLibraryPermissionsAsync,
} from "expo-image-picker";

import { HttpStatusError } from "../../../../api/errors";
import { sha256DigestToHex } from "./product-photos-checksum";
import {
  MAX_UPLOAD_BYTES,
  PHOTO_MAX_EDGE,
  PHOTO_START_COMPRESS,
  type CatalogImageMime,
} from "./product-photos-limits";
import {
  catalogImagePreparePlan,
  catalogImageStrategy,
  nextPhotoCompressPlan,
} from "./product-photos-model";
import {
  CatalogImagePrepareError,
  type PreparedCatalogImage,
} from "./product-photos-upload";

export type PickedPhoto = {
  readonly uri: string;
  readonly mimeType: string | undefined;
  readonly fileName: string | undefined;
};

export type PickProductPhotosResult =
  | { readonly kind: "canceled" }
  | { readonly kind: "denied"; readonly source: "camera" | "library" }
  | { readonly kind: "picked"; readonly photos: readonly PickedPhoto[] };

export async function pickProductPhotos(
  source: "camera" | "library",
  remaining: number,
): Promise<PickProductPhotosResult> {
  if (remaining < 1) {
    return { kind: "canceled" };
  }
  if (source === "camera") {
    const permission = await requestCameraPermissionsAsync();
    if (permission.status !== PermissionStatus.GRANTED) {
      return { kind: "denied", source: "camera" };
    }
    const result = await launchCameraAsync({
      mediaTypes: ["images"],
      quality: 1,
      allowsEditing: false,
      exif: false,
    });
    if (result.canceled || result.assets.length === 0) {
      return { kind: "canceled" };
    }
    return { kind: "picked", photos: assetsToPhotos(result.assets) };
  }
  const permission = await requestMediaLibraryPermissionsAsync();
  if (permission.status !== PermissionStatus.GRANTED) {
    return { kind: "denied", source: "library" };
  }
  const result = await launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 1,
    allowsEditing: false,
    allowsMultipleSelection: remaining > 1,
    selectionLimit: remaining,
    exif: false,
  });
  if (result.canceled || result.assets.length === 0) {
    return { kind: "canceled" };
  }
  return {
    kind: "picked",
    photos: assetsToPhotos(result.assets).slice(0, remaining),
  };
}

export async function prepareCatalogImage(args: {
  readonly uri: string;
  readonly mimeType: string | undefined;
  readonly fileName: string | undefined;
}): Promise<PreparedCatalogImage> {
  try {
    return await compressCatalogImage(args);
  } catch (error: unknown) {
    if (error instanceof CatalogImagePrepareError) {
      throw error;
    }
    throw new CatalogImagePrepareError("unavailable");
  }
}

async function compressCatalogImage(args: {
  readonly uri: string;
  readonly mimeType: string | undefined;
  readonly fileName: string | undefined;
}): Promise<PreparedCatalogImage> {
  const strategy = catalogImageStrategy(args.mimeType, args.fileName);
  const original = new File(args.uri);
  let uri = args.uri;
  let edge = PHOTO_MAX_EDGE;
  let compress = PHOTO_START_COMPRESS;
  let mime: CatalogImageMime =
    strategy === "convert-jpeg" ? "image/jpeg" : mimeForStrategy(strategy);
  let format = saveFormatFor(mime);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const rendered = await ImageManipulator.manipulate(uri).renderAsync();
    const longEdge = Math.max(rendered.width, rendered.height);
    if (
      attempt === 0 &&
      catalogImagePreparePlan({
        strategy,
        byteSize: original.size,
        longEdge,
      }).kind === "keep"
    ) {
      return hashFile(original, mime);
    }
    const resized =
      longEdge > edge
        ? await ImageManipulator.manipulate(uri)
            .resize(
              rendered.width >= rendered.height
                ? { width: edge }
                : { height: edge },
            )
            .renderAsync()
        : rendered;
    const saved = await resized.saveAsync({ compress, format });
    const file = new File(saved.uri);
    const plan = nextPhotoCompressPlan({
      byteSize: file.size,
      edge,
      compress,
    });
    if (plan.kind === "ok") {
      return hashFile(file, mime);
    }
    if (plan.kind === "fail") {
      throw new CatalogImagePrepareError("validation");
    }
    uri = saved.uri;
    edge = plan.edge;
    compress = plan.compress;
    mime = "image/jpeg";
    format = SaveFormat.JPEG;
  }
  throw new CatalogImagePrepareError("validation");
}

export async function putCatalogBytes(args: {
  readonly uri: string;
  readonly uploadUrl: string;
  readonly mimeType: CatalogImageMime;
  readonly signal: AbortSignal;
  readonly onProgress: (ratio: number) => void;
}): Promise<void> {
  const file = new File(args.uri);
  const task = file.createUploadTask(args.uploadUrl, {
    httpMethod: "PUT",
    uploadType: UploadType.BINARY_CONTENT,
    headers: { "Content-Type": args.mimeType },
    mimeType: args.mimeType,
    sessionType: "foreground",
    signal: args.signal,
    onProgress: (data) => {
      const total = data.totalBytes > 0 ? data.totalBytes : 1;
      args.onProgress(Math.min(1, data.bytesSent / total));
    },
  });
  const result = await task.uploadAsync();
  if (result.status < 200 || result.status >= 300) {
    throw new HttpStatusError(result.status);
  }
}

function assetsToPhotos(
  assets: readonly {
    readonly uri: string;
    readonly mimeType?: string;
    readonly fileName?: string | null;
  }[],
): PickedPhoto[] {
  return assets.map((asset) => ({
    uri: asset.uri,
    mimeType: asset.mimeType,
    fileName: asset.fileName ?? undefined,
  }));
}

function mimeForStrategy(
  strategy: Exclude<ReturnType<typeof catalogImageStrategy>, "convert-jpeg">,
): CatalogImageMime {
  if (strategy === "keep-png") {
    return "image/png";
  }
  if (strategy === "keep-webp") {
    return "image/webp";
  }
  return "image/jpeg";
}

function saveFormatFor(mime: CatalogImageMime): SaveFormat {
  if (mime === "image/png") {
    return SaveFormat.PNG;
  }
  if (mime === "image/webp") {
    return SaveFormat.WEBP;
  }
  return SaveFormat.JPEG;
}

async function hashFile(
  file: File,
  mimeType: CatalogImageMime,
): Promise<PreparedCatalogImage> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (bytes.byteLength < 1 || bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new CatalogImagePrepareError("validation");
  }
  const hashed = await digest(CryptoDigestAlgorithm.SHA256, bytes);
  return {
    uri: file.uri,
    mimeType,
    byteSize: bytes.byteLength,
    checksumSha256: sha256DigestToHex(hashed),
  };
}
