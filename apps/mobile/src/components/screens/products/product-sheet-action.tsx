import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

/**
 * Canvas product/variant sheet action row: icon well + label.
 * Feature chrome — not a generic list row.
 */
export function ProductSheetAction(props: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly onPress: () => void;
  readonly danger?: boolean;
}) {
  const danger = props.danger === true;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      onPress={props.onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      <View style={styles.iconWell}>{props.icon}</View>
      <Text style={danger ? styles.dangerLabel : styles.label}>
        {props.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    minHeight: theme.hitTarget.field,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
    ...theme.squircle,
    paddingHorizontal: theme.spacing.lg,
  },
  iconWell: {
    width: theme.spacing["3xl"] + theme.spacing.sm,
    height: theme.spacing["3xl"] + theme.spacing.sm,
    borderRadius: theme.radii.md,
    ...theme.squircle,
    backgroundColor: theme.colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    flex: 1,
    color: theme.colors.foreground,
    fontSize: theme.typography.base.fontSize,
    lineHeight: theme.typography.base.lineHeight,
    fontWeight: "500",
  },
  dangerLabel: {
    flex: 1,
    color: theme.colors.destructive,
    fontSize: theme.typography.base.fontSize,
    lineHeight: theme.typography.base.lineHeight,
    fontWeight: "500",
  },
  pressed: {
    opacity: 0.85,
  },
}));
