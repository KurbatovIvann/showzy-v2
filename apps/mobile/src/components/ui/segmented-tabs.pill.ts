/**
 * Sliding selected pill (v1 SegmentedControl indicator). First measure and
 * reduced motion snap; a tab change animates.
 */

export type SegmentedPillBox = {
  readonly x: number;
  readonly width: number;
};

export type SegmentedPillMove = "layout" | "select";

export function shouldSnapSegmentedPill(args: {
  readonly placed: boolean;
  readonly reduceMotion: boolean;
  readonly reason: SegmentedPillMove;
}): boolean {
  if (!args.placed) {
    return true;
  }
  if (args.reduceMotion) {
    return true;
  }
  return args.reason === "layout";
}

/**
 * Ignore a selected-tab onLayout that only restyles text, so it cannot
 * snap the pill to the destination and cancel the slide.
 */
export function segmentedPillLayoutMove(args: {
  readonly isSelected: boolean;
  readonly placed: boolean;
  readonly prev: SegmentedPillBox | undefined;
  readonly next: SegmentedPillBox;
}): SegmentedPillMove | null {
  if (!args.isSelected) {
    return null;
  }
  if (!args.placed) {
    return "layout";
  }
  if (args.prev === undefined) {
    return "select";
  }
  if (args.prev.x !== args.next.x || args.prev.width !== args.next.width) {
    return "layout";
  }
  return null;
}
