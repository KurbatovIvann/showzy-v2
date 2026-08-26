/**
 * Batched list thumbnails (SHO-140 / SHO-157). Download URLs come from
 * `apps/mobile/src/api/file-download-query.ts` — do not duplicate that
 * handshake here.
 */
import { useQueries } from "@tanstack/react-query";

import type { ContractClient } from "../../../../api/client";
import { fileDownloadUrlsQueryOptions } from "../../../../api/file-download-query";
import type { ProductListItem } from "../api/product.queries";

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
  readonly refetch: () => void;
} {
  const thumbnailQueries = useQueries({
    queries: args.pages.map((page) => {
      const fileIds = uniquePrimaryImageFileIds(page.items);
      const options = fileDownloadUrlsQueryOptions({
        client: args.client,
        companyId: args.companyId,
        fileIds,
        getActiveCompany: args.getActiveCompany,
      });
      return {
        ...options,
        enabled: options.enabled && args.enabled,
      };
    }),
  });
  const urlsByFileId = mergeDownloadUrlPages(
    thumbnailQueries.map((query) => query.data),
  );

  return {
    urlsByFileId,
    refetch: () => {
      for (const query of thumbnailQueries) {
        void query.refetch();
      }
    },
  };
}
