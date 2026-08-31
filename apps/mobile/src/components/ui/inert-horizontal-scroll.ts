import type { ScrollViewProps } from "react-native";

/**
 * Horizontal scroller that does not bounce, fade, or inherit safe-area
 * insets. Shared by SegmentedTabs (scroll layout) and ChoiceField.
 */
export const inertHorizontalScrollProps = {
  horizontal: true,
  showsHorizontalScrollIndicator: false,
  bounces: false,
  alwaysBounceHorizontal: false,
  overScrollMode: "never",
  fadingEdgeLength: 0,
  automaticallyAdjustContentInsets: false,
  contentInsetAdjustmentBehavior: "never",
  contentInset: { left: 0, right: 0 },
} as const satisfies ScrollViewProps;
