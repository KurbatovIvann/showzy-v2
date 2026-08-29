import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronRightIcon } from "lucide-react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { companySettingsRowAccessibilityLabel } from "./company-settings.presenter";

/**
 * Canvas `CompanySettingsRow`: icon well, label, wrapping description
 * (attention ink when legal is missing), chevron. Feature-local — it
 * knows the company hub, not a generic list row.
 */
export function CompanySettingsRow(props: {
  readonly label: string;
  readonly description: string;
  readonly icon: ReactNode;
  readonly attention?: boolean;
  readonly onPress: () => void;
}) {
  const { theme } = useUnistyles();
  const attention = props.attention === true;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={companySettingsRowAccessibilityLabel({
        label: props.label,
        description: props.description,
      })}
      onPress={props.onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      <View style={styles.iconWell}>{props.icon}</View>
      <View style={styles.copy}>
        <Text style={styles.label}>{props.label}</Text>
        <Text style={[styles.description, attention ? styles.attention : null]}>
          {props.description}
        </Text>
      </View>
      <ChevronRightIcon
        size={theme.iconSize.sm}
        color={theme.colors.icon.muted}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    minHeight: theme.hitTarget.min + theme.spacing["2xl"],
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  pressed: {
    backgroundColor: theme.colors.background,
  },
  iconWell: {
    width: theme.hitTarget.min,
    height: theme.hitTarget.min,
    borderRadius: theme.radii.lg,
    ...theme.squircle,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: theme.spacing["2xs"],
  },
  label: {
    color: theme.colors.foreground,
    fontSize: theme.typography.base.fontSize,
    lineHeight: theme.typography.base.lineHeight,
    fontWeight: "600",
  },
  description: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
  },
  attention: {
    color: theme.colors.warning,
  },
}));
