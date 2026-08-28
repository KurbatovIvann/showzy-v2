export type OptionSelectItem = {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
};

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
