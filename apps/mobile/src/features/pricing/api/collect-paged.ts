/**
 * Paginate a cursor list until `nextCursor` is null. Used by the editor
 * to load every catalog product and every price-list entry (SHO-190).
 */
export async function collectPagedItems<T>(
  fetchPage: (
    cursor: string | null,
  ) => Promise<{
    readonly items: readonly T[];
    readonly nextCursor: string | null;
  }>,
): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | null = null;
  const seen = new Set<string>();
  for (;;) {
    if (cursor !== null) {
      if (seen.has(cursor)) {
        return items;
      }
      seen.add(cursor);
    }
    const page = await fetchPage(cursor);
    items.push(...page.items);
    if (page.nextCursor === null) {
      return items;
    }
    cursor = page.nextCursor;
  }
}
