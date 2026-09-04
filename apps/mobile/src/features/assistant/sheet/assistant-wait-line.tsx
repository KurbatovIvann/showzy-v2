import { memo } from "react";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { useRotatingWaitLine } from "./use-rotating-wait-line";

/**
 * One in-character wait line for the live turn. Rotating copy is visual
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
    >
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
  line: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
  },
}));
