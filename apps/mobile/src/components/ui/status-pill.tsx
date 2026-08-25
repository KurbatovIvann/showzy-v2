import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

export type StatusPillTone =
  "neutral" | "action" | "success" | "attention" | "danger";

/**
 * Canvas `StatusPill`: capsule badge with a soft tone fill. Status is
 * never color-only — the label is mandatory (mp-to-mobile.md).
 */
export function StatusPill(props: {
  readonly label: string;
  readonly tone?: StatusPillTone;
}) {
  const tone = props.tone ?? "neutral";
  return (
    <View style={[styles.pill, styles[tone]]}>
      <Text style={[styles.label, styles[`${tone}Label`]]}>{props.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  pill: {
    alignSelf: "flex-start",
    borderRadius: theme.radii.full,
    borderWidth: 1,
    borderColor: "transparent",
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing["2xs"],
  },
  label: {
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
    fontWeight: "500",
  },
  neutral: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border,
  },
  neutralLabel: {
    color: theme.colors.mutedForeground,
  },
  action: {
    backgroundColor: theme.colors.accentSoft,
  },
  actionLabel: {
    color: theme.colors.accent,
  },
  success: {
    backgroundColor: theme.colors.successSoft,
  },
  successLabel: {
    color: theme.colors.success,
  },
  attention: {
    backgroundColor: theme.colors.warningSoft,
  },
  attentionLabel: {
    color: theme.colors.warning,
  },
  danger: {
    backgroundColor: theme.colors.destructiveSoft,
  },
  dangerLabel: {
    color: theme.colors.destructive,
  },
}));
