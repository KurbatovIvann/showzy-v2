/**
 * Batched list thumbnails (SHO-140 / SHO-157 / SHO-247). Download URLs
 * come from `apps/mobile/src/api/file-download-query.ts` — do not
 * duplicate that handshake here. List cells request the named `thumb`
 * rendition (SHO-244); they never sign the original.
 */
import { useQueries } from "@tanstack/react-query";

import type { ContractClient } from "../../../../api/client";
import {
  fileDownloadUrlsQueryOptions,
  type FileDownloadClient,
} from "../../../../api/file-download-query";
import type { ProductListItem } from "../api/product.queries";

/** Named catalog size for product list cells (SHO-244). */
export const PRODUCT_LIST_RENDITION = "thumb" as const;

export function productListDownloadInput(fileIds: readonly string[]): {
  readonly fileIds: string[];
  readonly rendition: typeof PRODUCT_LIST_RENDITION;
} {
  return { fileIds: [...fileIds], rendition: PRODUCT_LIST_RENDITION };
}

/**
 * Live list thumbnail query (SHO-140 / SHO-247). `enabled` is the
 * `files:view` affordance from the list composer; roles without it skip
 * the download. Rendition is always `thumb`.
 */
export function productListThumbnailQueryOptions(args: {
  readonly client: FileDownloadClient | null;
  readonly companyId: string | null;
  readonly getActiveCompany: () => string | null;
  readonly fileIds: readonly string[];
  readonly enabled: boolean;
}) {
  const options = fileDownloadUrlsQueryOptions({
    client: args.client,
    companyId: args.companyId,
    getActiveCompany: args.getActiveCompany,
    ...productListDownloadInput(args.fileIds),
  });
  return {
    ...options,
    enabled: options.enabled && args.enabled,
  };
}

/** First-seen unique `primaryImageFileId` values for one list page. */
export function uniquePrimaryImageFileIds(
  items: ReadonlyArray<{ readonly primaryImageFileId: string | null }>,
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const fileId = item.primaryImageFileId;
    if (fileId === null || seen.has(fileId)) {
      continue;
    }
    seen.add(fileId);
    ids.push(fileId);
  }
  return ids;
}

export function mergeDownloadUrlPages(
  pages: ReadonlyArray<
    | {
        readonly files: ReadonlyArray<{
          readonly fileId: string;
          readonly downloadUrl: string;
        }>;
      }
    | undefined
  >,
): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const page of pages) {
    if (page === undefined) {
      continue;
    }
    for (const file of page.files) {
      map.set(file.fileId, file.downloadUrl);
    }
  }
  return map;
}

/** Primary image ids on pages whose `getDownloadUrls` query failed. */
export function failedPrimaryImageFileIds(
  pages: ReadonlyArray<{
    readonly items: ReadonlyArray<{
      readonly primaryImageFileId: string | null;
    }>;
  }>,
  queryFailed: readonly boolean[],
): ReadonlySet<string> {
  const failed = new Set<string>();
  for (let index = 0; index < pages.length; index += 1) {
    if (queryFailed[index] !== true) {
      continue;
    }
    const page = pages[index];
    if (page === undefined) {
      continue;
    }
    for (const id of uniquePrimaryImageFileIds(page.items)) {
      failed.add(id);
    }
  }
  return failed;
}

/**
 * List thumbnail path. A download-query error is `failed`, not
 * "success with an empty URL" (package placeholder).
 */
export function resolveProductThumbnail(args: {
  readonly fileId: string | null;
  readonly url: string | undefined;
  readonly downloadFailed: boolean;
}):
  | { readonly kind: "empty" }
  | { readonly kind: "failed" }
  | { readonly kind: "ready"; readonly url: string } {
  if (args.fileId === null) {
    return { kind: "empty" };
  }
  if (args.url !== undefined && args.url.length > 0) {
    return { kind: "ready", url: args.url };
  }
  if (args.downloadFailed) {
    return { kind: "failed" };
  }
  return { kind: "empty" };
}

export function useProductThumbnails(args: {
  readonly client: ContractClient | null;
  readonly companyId: string | null;
  readonly getActiveCompany: () => string | null;
  readonly pages: ReadonlyArray<{
    readonly items: readonly ProductListItem[];
  }>;
  readonly enabled: boolean;
}): {
  readonly urlsByFileId: ReadonlyMap<string, string>;
  readonly failedFileIds: ReadonlySet<string>;
  readonly refetch: () => void;
} {
  const thumbnailQueries = useQueries({
    queries: args.pages.map((page) =>
      productListThumbnailQueryOptions({
        client: args.client,
        companyId: args.companyId,
        getActiveCompany: args.getActiveCompany,
        fileIds: uniquePrimaryImageFileIds(page.items),
        enabled: args.enabled,
      }),
    ),
  });
  const urlsByFileId = mergeDownloadUrlPages(
    thumbnailQueries.map((query) => query.data),
  );
  const failedFileIds = failedPrimaryImageFileIds(
    args.pages,
    thumbnailQueries.map((query) => query.isError),
  );

  return {
    urlsByFileId,
    failedFileIds,
    refetch: () => {
      for (const query of thumbnailQueries) {
        void query.refetch();
      }
    },
  };
}
