export type OptionSelectItem = {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
};

export function optionSelectItems(
  items: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly description?: string | null;
  }>,
): readonly OptionSelectItem[] {
  return items.map((item) => {
    const description =
      item.description != null && item.description.length > 0
        ? item.description
        : undefined;
    if (description === undefined) {
      return { id: item.id, name: item.name };
    }
    return { id: item.id, name: item.name, description };
  });
}

/**
 * Selector display: null id uses the inherit placeholder; a named id
 * uses the lookup; a still-set unnamed id uses `unnamedFallback` so it
 * is not shown as inherit.
 */
export function selectorLookupValue(
  id: string | null,
  names: ReadonlyMap<string, string>,
  unnamedFallback: string,
): string | undefined {
  if (id === null) {
    return undefined;
  }
  return names.get(id) ?? unnamedFallback;
}

export function filterOptionSelectItems(
  options: readonly OptionSelectItem[],
  query: string,
): readonly OptionSelectItem[] {
  const normalized = query.trim().toLowerCase();
  if (normalized.length === 0) {
    return options;
  }
  return options.filter((option) =>
    option.name.toLowerCase().includes(normalized),
  );
}
