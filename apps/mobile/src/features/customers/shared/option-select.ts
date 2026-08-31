export {
  optionSelectItems,
  type OptionSelectItem,
} from "../../../components/ui/option-select";

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
