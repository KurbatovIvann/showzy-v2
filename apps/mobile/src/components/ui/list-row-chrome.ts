/**
 * Canvas `ListRow` chrome: hairline above every row except `first`.
 * `provisional` is unused visual-only dashed chrome — do not wire writes.
 */
export function listRowChrome(input: {
  readonly first?: boolean;
  readonly provisional?: boolean;
}): {
  readonly showDivider: boolean;
  readonly provisional: boolean;
} {
  return {
    showDivider: input.first !== true,
    provisional: input.provisional === true,
  };
}
