/**
 * Scroll offset so a selected tab sits in view with a small gutter.
 * Used by the scrollable `SegmentedTabs` layout (v1 overlay-tabs behavior
 * without edge fade masks).
 */
export function scrollXToRevealTab(args: {
  readonly tabX: number;
  readonly tabWidth: number;
  readonly viewportWidth: number;
  readonly contentWidth: number;
  readonly gutter: number;
}): number {
  const maxScroll = Math.max(0, args.contentWidth - args.viewportWidth);
  if (maxScroll === 0 || args.viewportWidth <= 0) {
    return 0;
  }
  const aligned = args.tabX - args.gutter;
  return Math.min(maxScroll, Math.max(0, aligned));
}
