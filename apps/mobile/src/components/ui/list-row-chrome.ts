/**
 * Canvas `ListRow` chrome: hairline above every row except `first`.
 * `provisional` is unused visual-only dashed chrome — do not wire writes.
 * `groupEdge` draws ListSurface corners on a virtualized grouped list
 * (orders sticky «В роботі» / «Завершені») where a wrapping `ListSurface`
 * would clip those headers.
 */

export type ListRowGroupEdge = "start" | "middle" | "end" | "only";

export function listRowChrome(input: {
  readonly first?: boolean | undefined;
  readonly provisional?: boolean | undefined;
  readonly groupEdge?: ListRowGroupEdge | undefined;
}): {
  readonly showDivider: boolean;
  readonly provisional: boolean;
  readonly groupEdge: ListRowGroupEdge | null;
} {
  const groupEdge = input.groupEdge ?? null;
  const firstInSurface =
    input.first === true || groupEdge === "start" || groupEdge === "only";
  return {
    showDivider: !firstInSurface,
    provisional: input.provisional === true,
    groupEdge,
  };
}

export function listGroupEdge(
  index: number,
  count: number,
): ListRowGroupEdge | null {
  if (count <= 0 || index < 0 || index >= count) {
    return null;
  }
  if (count === 1) {
    return "only";
  }
  if (index === 0) {
    return "start";
  }
  if (index === count - 1) {
    return "end";
  }
  return "middle";
}
