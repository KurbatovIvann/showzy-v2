/**
 * Optical crop of `sit.svg` so the BottomNav circle shows the head, not
 * the sitting body. The asset viewBox is 1254²; ear tips sit near y=76,
 * eyes near y=295. Scale and focus are local nudges, not theme tokens.
 */
export const SIT_SVG_VIEWBOX = 1254;
export const SIT_HEAD_FOCUS_X = 0.5;
export const SIT_HEAD_FOCUS_Y = 380 / SIT_SVG_VIEWBOX;
export const SIT_TAB_HEAD_SCALE = 1.4;

export function sitTabHeadImageLayout(circleSize: number): {
  readonly position: "absolute";
  readonly width: number;
  readonly height: number;
  readonly top: number;
  readonly left: number;
} {
  const size = circleSize * SIT_TAB_HEAD_SCALE;
  return {
    position: "absolute",
    width: size,
    height: size,
    top: circleSize / 2 - SIT_HEAD_FOCUS_Y * size,
    left: circleSize / 2 - SIT_HEAD_FOCUS_X * size,
  };
}
