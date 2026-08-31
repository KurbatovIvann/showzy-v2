/**
 * Shared infinite-query drain predicate for lookup pickers and list
 * chips. Feature slices must not copy this helper.
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
