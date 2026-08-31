/**
 * Live strip / form / editable-detail download query (SHO-303). Transport
 * home for the photo-strip `*QueryOptions` builders — not a view-model.
 */
import {
  fileDownloadUrlsQueryOptions,
  type FileDownloadClient,
} from "../../../../api/file-download-query";

/**
 * Named catalog size for the 160px ProductImagePicker strip (SHO-244).
 * Form and product-detail photos are that strip today, so they request
 * `card` — not `hero` (named amendment: no large product-page gallery).
 */
export const PRODUCT_PHOTOS_STRIP_RENDITION = "card" as const;

export function productPhotosStripDownloadInput(fileIds: readonly string[]): {
  readonly fileIds: string[];
  readonly rendition: typeof PRODUCT_PHOTOS_STRIP_RENDITION;
} {
  return { fileIds: [...fileIds], rendition: PRODUCT_PHOTOS_STRIP_RENDITION };
}

/**
 * Live strip / form / editable-detail download query. Roles without
 * `files:view` (and write-disabled sessions) pass `client: null` so the
 * query stays disabled.
 */
export function productPhotosStripQueryOptions(args: {
  readonly client: FileDownloadClient | null;
  readonly companyId: string | null;
  readonly getActiveCompany: () => string | null;
  readonly fileIds: readonly string[];
  readonly canWrite: boolean;
  readonly canFetchImages: boolean;
}) {
  return fileDownloadUrlsQueryOptions({
    client: args.canWrite && args.canFetchImages ? args.client : null,
    companyId: args.companyId,
    getActiveCompany: args.getActiveCompany,
    ...productPhotosStripDownloadInput(args.fileIds),
  });
}
