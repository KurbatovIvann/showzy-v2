/**
 * Shared infinite-query drain predicate for group and price-list
 * lookups (list chips and form pickers).
 */
export function shouldDrainNextPage(args: {
  readonly status: "pending" | "error" | "success";
  readonly hasNextPage: boolean;
  readonly isFetchingNextPage: boolean;
}): boolean {
  return (
    args.status === "success" && args.hasNextPage && !args.isFetchingNextPage
  );
}
