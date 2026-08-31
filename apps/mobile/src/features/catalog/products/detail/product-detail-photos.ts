/**
 * Detail → photo-manager wiring (SHO-160 / SHO-247). Pass `imageFileIds`
 * from `catalog.getProduct`; the manager must not start a second
 * getProduct.
 *
 * Product-detail photos are the 160px ProductImagePicker strip, so
 * downloads use `card` (SHO-244 "160px tiles -> card"). There is no
 * large hero gallery or lightbox, so this slice does not request `hero`
 * or `full`. The pre-existing read-only viewer keeps its own query
 * (`!canEdit && canFetchImages`); seeded roles never enable it because
 * `canEditProducts` and `canFetchFileDownloadUrls` are identical.
 */
import {
  fileDownloadUrlsQueryOptions,
  type FileDownloadClient,
} from "../../../../api/file-download-query";
import {
  committedSlotsFromFileIds,
  productPhotosStripDownloadInput,
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

/**
 * Read-only 160px strip downloads. Editable detail uses
 * `productPhotosStripQueryOptions` instead (same `card` rendition).
 */
export function productDetailViewerDownloadQueryOptions(args: {
  readonly client: FileDownloadClient | null;
  readonly companyId: string | null;
  readonly getActiveCompany: () => string | null;
  readonly imageFileIds: readonly string[];
  readonly canEdit: boolean;
  readonly canFetchImages: boolean;
}) {
  return fileDownloadUrlsQueryOptions({
    client: !args.canEdit && args.canFetchImages ? args.client : null,
    companyId: args.companyId,
    getActiveCompany: args.getActiveCompany,
    ...productPhotosStripDownloadInput(args.canEdit ? [] : args.imageFileIds),
  });
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
