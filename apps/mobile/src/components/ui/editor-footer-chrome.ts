/**
 * Canvas `EditorFooter` slot precedence: empty line, else meta row,
 * else hint. A `leading` ReactNode is the scaffold `footerLeading`
 * passthrough when those typed slots are unused.
 */
export function editorFooterChrome(input: {
  readonly empty?: boolean | undefined;
  readonly emptyLabel?: string | undefined;
  readonly metaLabel?: string | undefined;
  readonly hint?: string | undefined;
  readonly leading?: boolean | undefined;
}): {
  readonly showEmpty: boolean;
  readonly showMeta: boolean;
  readonly showHint: boolean;
  readonly showLeading: boolean;
} {
  const showEmpty = input.empty === true && (input.emptyLabel?.length ?? 0) > 0;
  const showMeta = !showEmpty && (input.metaLabel?.length ?? 0) > 0;
  const showHint = !showEmpty && !showMeta && (input.hint?.length ?? 0) > 0;
  const showLeading =
    !showEmpty && !showMeta && !showHint && input.leading === true;
  return { showEmpty, showMeta, showHint, showLeading };
}
