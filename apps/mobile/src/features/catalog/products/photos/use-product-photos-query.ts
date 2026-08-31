/**
 * Strip download Query wiring for the photo manager (SHO-303).
 */
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import type { FileDownloadClient } from "../../../../api/file-download-query";
import {
  describeQueryFailure,
  type QueryFailureKind,
} from "../../../../api/errors";
import { productPhotosStripQueryOptions } from "./product-photos-queries";
import type { PhotoSlot } from "./product-photos-slots";

export function useProductPhotosQuery(args: {
  readonly client: FileDownloadClient | null;
  readonly companyId: string | null;
  readonly getActiveCompany: () => string | null;
  readonly slots: readonly PhotoSlot[];
  readonly canWrite: boolean;
  readonly canFetchImages: boolean;
}): {
  readonly previewByFileId: ReadonlyMap<string, string>;
  readonly downloadFailure: QueryFailureKind | null;
  readonly refetch: () => void;
} {
  const committedIds = useMemo(
    () =>
      args.slots
        .filter((slot) => slot.kind === "committed")
        .map((slot) => slot.fileId),
    [args.slots],
  );
  const urlsQuery = useQuery(
    productPhotosStripQueryOptions({
      client: args.client,
      companyId: args.companyId,
      getActiveCompany: args.getActiveCompany,
      fileIds: committedIds,
      canWrite: args.canWrite,
      canFetchImages: args.canFetchImages,
    }),
  );
  const previewByFileId = useMemo(() => {
    const map = new Map<string, string>();
    for (const file of urlsQuery.data?.files ?? []) {
      map.set(file.fileId, file.downloadUrl);
    }
    return map;
  }, [urlsQuery.data?.files]);

  return {
    previewByFileId,
    downloadFailure: urlsQuery.isError
      ? describeQueryFailure(urlsQuery.error).kind
      : null,
    refetch: () => {
      void urlsQuery.refetch();
    },
  };
}
