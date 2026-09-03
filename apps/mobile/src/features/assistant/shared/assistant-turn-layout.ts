/**
 * SHO-384: definite width for the assistant column so nested `flex: 1`
 * labels (timeline, list/aggregate rows, HITL actions) resolve against a
 * bounded parent. Yoga shrink-wraps `maxWidth` + `alignItems: flex-start`
 * with no `width` to the child's intrinsic size → width 0 on those labels.
 * Result Cards stretch to that column; the text bubble stays shrink-wrapped.
 */
export const ASSISTANT_TURN_COLUMN_WIDTH = "92%";

export const assistantTurnColumnLayout = {
  alignItems: "flex-start",
  width: ASSISTANT_TURN_COLUMN_WIDTH,
} as const;

export const assistantTurnResultStretch = {
  alignSelf: "stretch",
  width: "100%",
  minWidth: 0,
} as const;
