/**
 * Detail → photo-manager wiring (SHO-160). Pass `imageFileIds` from
 * `catalog.getProduct`; the manager must not start a second getProduct.
 */
import {
  committedSlotsFromFileIds,
  toPhotoTiles,
  type PhotoTileView,
} from "../photos/product-photos-model";

export type ProductDetailPhotoManagerInput = {
  readonly productId: string | null;
  readonly imageFileIds: readonly string[] | undefined;
  readonly requireProduct: true;
  readonly canWrite: boolean;
};

export function imageFileIdsFromGetProduct(
  data: { readonly imageFileIds: readonly string[] } | undefined,
): readonly string[] | undefined {
  return data === undefined ? undefined : data.imageFileIds;
}

export function photoManagerInputFromDetailQuery(args: {
  readonly productId: string | null;
  readonly imageFileIds: readonly string[] | undefined;
  readonly canWrite: boolean;
}): ProductDetailPhotoManagerInput {
  return {
    productId: args.productId,
    imageFileIds: args.imageFileIds,
    requireProduct: true,
    canWrite: args.canWrite,
  };
}

export function detailViewerPhotoTiles(
  imageFileIds: readonly string[],
): readonly PhotoTileView[] {
  return toPhotoTiles(committedSlotsFromFileIds(imageFileIds));
}

export function detailViewerPreviewByFileId(
  files: ReadonlyArray<{
    readonly fileId: string;
    readonly downloadUrl: string;
  }>,
): ReadonlyMap<string, string> {
  const previewByFileId = new Map<string, string>();
  for (const file of files) {
    previewByFileId.set(file.fileId, file.downloadUrl);
  }
  return previewByFileId;
}
