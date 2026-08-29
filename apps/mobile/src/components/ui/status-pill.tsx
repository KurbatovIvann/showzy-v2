import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

export type StatusPillTone =
  "neutral" | "action" | "success" | "attention" | "danger";

export type StatusPillSize = "sm" | "md";

/**
 * Canvas `StatusPill`: capsule badge with a soft tone fill. Status is
 * never color-only — the label is mandatory (mp-to-mobile.md).
 * `sm` is list chips (canvas `text-[12px]` → `typography.xs`). `md` is
 * the order-detail cluster (canvas `px-2.5 py-1 text-[13px]`).
 */
export function StatusPill(props: {
  readonly label: string;
  readonly tone?: StatusPillTone;
  readonly size?: StatusPillSize;
}) {
  const tone = props.tone ?? "neutral";
  const size = props.size ?? "sm";
  return (
    <View
      style={[styles.pill, size === "md" ? styles.pillMd : null, styles[tone]]}
    >
      <Text style={[styles.label, styles[`${tone}Label`]]}>{props.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  pill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radii.full,
    borderWidth: 1,
    borderColor: "transparent",
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing["2xs"],
  },
  pillMd: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
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
