/**
 * Batched list thumbnails for orders. Download URLs come from
 * `apps/web/src/api/file-download-query.ts`. Lives in `shared/` so
 * detail and create reuse it. Named `thumb` rendition (SHO-244).
 *
 * Always call this hook — never after an early return. Empty `pages`
 * or `enabled: false` still run `useQueries` once.
 */
import { useQueries } from "@tanstack/react-query";
import { useRef } from "react";

import {
  fileDownloadUrlsQueryOptions,
  type FileDownloadClient,
} from "../../../api/file-download-query";
import {
  failedPrimaryImageFileIds,
  mergeDownloadUrlPages,
  retainStringMap,
  retainStringSet,
  uniquePrimaryImageFileIds,
} from "./order-thumbnails";

/** Named catalog size for order line / picker cells (SHO-244). */
export const ORDER_THUMB_RENDITION = "thumb" as const;

export function useOrderThumbnails(args: {
  readonly client: FileDownloadClient;
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
        rendition: ORDER_THUMB_RENDITION,
        getActiveCompany: args.getActiveCompany,
      });
      return {
        ...options,
        enabled: options.enabled && args.enabled,
      };
    }),
  });
  const nextUrls = mergeDownloadUrlPages(
    thumbnailQueries.map((query) => query.data),
  );
  const nextFailed = failedPrimaryImageFileIds(
    args.pages,
    thumbnailQueries.map((query) => query.isError),
  );
  const urlsRef = useRef<ReadonlyMap<string, string> | undefined>(undefined);
  const failedRef = useRef<ReadonlySet<string> | undefined>(undefined);
  const urlsByFileId = retainStringMap(urlsRef.current, nextUrls);
  const failedFileIds = retainStringSet(failedRef.current, nextFailed);
  urlsRef.current = urlsByFileId;
  failedRef.current = failedFileIds;

  return {
    urlsByFileId,
    failedFileIds,
  };
}
