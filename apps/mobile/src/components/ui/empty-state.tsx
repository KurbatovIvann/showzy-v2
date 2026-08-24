import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

/** Canvas empty-state pattern: centered icon badge, title, muted
 * description, optional action slot. Callers color the icon. */
export function EmptyState(props: {
  readonly icon: ReactNode;
  readonly title: string;
  readonly description: string;
  readonly action?: ReactNode;
}) {
  return (
    <View style={styles.container}>
      <View style={styles.badge}>{props.icon}</View>
      <Text style={styles.title}>{props.title}</Text>
      <Text style={styles.description}>{props.description}</Text>
      {props.action != null ? (
        <View style={styles.action}>{props.action}</View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    alignItems: "center",
    paddingHorizontal: theme.spacing["3xl"],
    paddingVertical: theme.spacing["3xl"],
  },
  badge: {
    width: theme.hitTarget.field,
    height: theme.hitTarget.field,
    borderRadius: theme.radii.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.muted,
    marginBottom: theme.spacing.lg,
  },
  title: {
    color: theme.colors.foreground,
    textAlign: "center",
    fontSize: theme.typography.lg.fontSize,
    lineHeight: theme.typography.lg.lineHeight,
    fontWeight: "600",
  },
  description: {
    color: theme.colors.mutedForeground,
    textAlign: "center",
    marginTop: theme.spacing.xs,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
  },
  action: {
    marginTop: theme.spacing.xl,
  },
}));
