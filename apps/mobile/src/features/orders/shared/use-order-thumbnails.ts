/**
 * Batched list thumbnails for orders (SHO-242 / SHO-243). Download URLs
 * come from `apps/mobile/src/api/file-download-query.ts` — do not
 * duplicate that handshake. Lives in `shared/` so the detail ticket can
 * reuse it without importing `features/catalog`.
 */
import { useQueries } from "@tanstack/react-query";

import type { ContractClient } from "../../../api/client";
import { fileDownloadUrlsQueryOptions } from "../../../api/file-download-query";
import {
  failedPrimaryImageFileIds,
  mergeDownloadUrlPages,
  uniquePrimaryImageFileIds,
} from "./order-thumbnails";

export function useOrderThumbnails(args: {
  readonly client: ContractClient | null;
  readonly companyId: string | null;
  readonly getActiveCompany: () => string | null;
  readonly pages: ReadonlyArray<{
    readonly items: ReadonlyArray<{
      readonly primaryImageFileId: string | null;
    }>;
  }>;
  readonly enabled: boolean;
}): {
  readonly urlsByFileId: ReadonlyMap<string, string>;
  readonly failedFileIds: ReadonlySet<string>;
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
  const failedFileIds = failedPrimaryImageFileIds(
    args.pages,
    thumbnailQueries.map((query) => query.isError),
  );

  return {
    urlsByFileId,
    failedFileIds,
  };
}
