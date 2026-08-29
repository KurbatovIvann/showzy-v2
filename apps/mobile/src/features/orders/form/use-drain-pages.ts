import { useEffect } from "react";

import { shouldDrainNextPage } from "./option-select";

/** Keep fetching lookup pages until the cursor is exhausted. */
export function useDrainInfinitePages(query: {
  readonly status: "pending" | "error" | "success";
  readonly hasNextPage: boolean;
  readonly isFetchingNextPage: boolean;
  readonly fetchNextPage: () => Promise<unknown>;
}): void {
  const { status, hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  useEffect(() => {
    if (
      !shouldDrainNextPage({
        status,
        hasNextPage,
        isFetchingNextPage,
      })
    ) {
      return;
    }
    void fetchNextPage();
  }, [status, hasNextPage, isFetchingNextPage, fetchNextPage]);
}
