import { memo } from "react";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { Card } from "../../../components/ui";
import type { AssistantTimelineStep } from "../shared/chat-rows";

/**
 * Canvas `AssistantTimeline` (mp-to-mobile.md): Card of job-label rows
 * with a status dot. Feature chrome — not a second shared Card.
 * List/aggregate/entity blocks stay T2–T4.
 */
export const AssistantTimeline = memo(function AssistantTimeline(props: {
  readonly steps: readonly AssistantTimelineStep[];
  readonly accessibilityLabel: string;
}) {
  if (props.steps.length === 0) {
    return null;
  }

  return (
    <Card>
      <View accessibilityLabel={props.accessibilityLabel} style={styles.body}>
        {props.steps.map((step) => (
          <TimelineStepRow
            key={step.id}
            label={step.label}
            status={step.status}
          />
        ))}
      </View>
    </Card>
  );
});

const TimelineStepRow = memo(function TimelineStepRow(props: {
  readonly label: string;
  readonly status: AssistantTimelineStep["status"];
}) {
  const queued = props.status === "queued";
  const running = props.status === "running";
  const done = props.status === "done";
  const failed = props.status === "error";

  return (
    <View style={styles.step}>
      <View
        style={[
          styles.dot,
          running
            ? styles.dotRunning
            : done
              ? styles.dotDone
              : failed
                ? styles.dotError
                : styles.dotQueued,
        ]}
      />
      <Text style={queued ? styles.labelQueued : styles.label}>
        {props.label}
      </Text>
      {running ? (
        <View style={styles.runningDots} accessibilityElementsHidden>
          <View style={styles.runningDot} />
          <View style={styles.runningDot} />
          <View style={styles.runningDot} />
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create((theme) => ({
  body: {
    gap: theme.spacing.sm,
  },
  step: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  dot: {
    width: theme.spacing.sm,
    height: theme.spacing.sm,
    borderRadius: theme.radii.full,
  },
  dotQueued: {
    backgroundColor: theme.colors.icon.muted,
  },
  dotRunning: {
    backgroundColor: theme.colors.accent,
  },
  dotDone: {
    backgroundColor: theme.colors.success,
  },
  dotError: {
    backgroundColor: theme.colors.destructive,
  },
  label: {
    flex: 1,
    color: theme.colors.foreground,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
  },
  labelQueued: {
    flex: 1,
    color: theme.colors.icon.muted,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
  },
  runningDots: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing["2xs"],
  },
  runningDot: {
    width: theme.spacing.xs,
    height: theme.spacing.xs,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.icon.muted,
  },
}));
