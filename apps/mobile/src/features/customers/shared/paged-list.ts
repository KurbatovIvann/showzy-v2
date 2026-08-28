/**
 * Shared list helpers for clients and groups (SHO-179). Lives in
 * `shared/` so `groups/` does not import the clients presenter.
 */

export function normalizeCustomersSearch(
  text: string,
  maxLength: number,
): string | undefined {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  return trimmed.slice(0, maxLength);
}

export function flattenPages<T>(
  pages: ReadonlyArray<{ readonly items: readonly T[] }>,
): readonly T[] {
  return pages.flatMap((page) => page.items);
}

export function nameById(
  items: ReadonlyArray<{ readonly id: string; readonly name: string }>,
): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const item of items) {
    map.set(item.id, item.name);
  }
  return map;
}
