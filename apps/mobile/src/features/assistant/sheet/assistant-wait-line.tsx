import { memo } from "react";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { SHOZIK_WAIT_POSE_SIZE } from "./assistant-chrome";
import { ShozikPoseMark } from "./shozik-pose-mark";
import { useRotatingWaitLine } from "./use-rotating-wait-line";

/**
 * One in-character wait chip for the live turn. Rotating copy is visual
 * only — the accessibility label stays on `waitLabel` so VoiceOver does
 * not announce a new screen every 2s.
 */
export const AssistantWaitLine = memo(function AssistantWaitLine(props: {
  readonly lines: readonly string[];
  readonly intervalMs: number;
  readonly accessibilityLabel: string;
}) {
  const line = useRotatingWaitLine({
    active: true,
    lines: props.lines,
    intervalMs: props.intervalMs,
  });

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={props.accessibilityLabel}
      accessibilityLiveRegion="polite"
      style={styles.chip}
    >
      <ShozikPoseMark pose="dig" size={SHOZIK_WAIT_POSE_SIZE} />
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.line}
      >
        {line}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create((theme) => ({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    maxWidth: "100%",
    backgroundColor: theme.colors.accentSoft,
    borderRadius: theme.radii.full,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  line: {
    flexShrink: 1,
    color: theme.colors.accentFg,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
    fontWeight: "500",
  },
}));
