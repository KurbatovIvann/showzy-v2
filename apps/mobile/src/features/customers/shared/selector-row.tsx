import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronRightIcon } from "lucide-react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { StatusPill } from "../../../components/ui";

/**
 * Canvas `SelectorRow`: a 44pt+ tappable field that opens a sheet.
 * Shared by customer editors (group form will reuse it).
 */
export function SelectorRow(props: {
  readonly label: string;
  readonly placeholder: string;
  readonly value?: string | undefined;
  readonly icon?: ReactNode | undefined;
  readonly error?: string | null | undefined;
  readonly changed?: boolean;
  readonly changedLabel?: string | undefined;
  readonly disabled?: boolean;
  readonly onPress: () => void;
}) {
  const { theme } = useUnistyles();
  const value =
    props.value != null && props.value.length > 0 ? props.value : null;
  const hasError = props.error != null && props.error.length > 0;
  const showChanged =
    props.changed === true &&
    props.changedLabel != null &&
    props.changedLabel.length > 0;
  const disabled = props.disabled === true;
  const a11yValue = value ?? props.placeholder;

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${props.label}: ${a11yValue}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={props.onPress}
        style={({ pressed }) => [
          styles.row,
          hasError ? styles.rowError : null,
          pressed && !disabled ? styles.pressed : null,
          disabled ? styles.disabled : null,
        ]}
      >
        {props.icon != null ? (
          <View style={styles.icon}>{props.icon}</View>
        ) : null}
        <View style={styles.body}>
          <View style={styles.labelRow}>
            <Text style={styles.label} numberOfLines={1}>
              {props.label}
            </Text>
            {showChanged ? (
              <StatusPill label={props.changedLabel ?? ""} tone="action" />
            ) : null}
          </View>
          <Text
            style={value !== null ? styles.value : styles.placeholder}
            numberOfLines={1}
          >
            {a11yValue}
          </Text>
        </View>
        <ChevronRightIcon
          size={theme.iconSize.sm}
          color={theme.colors.icon.muted}
        />
      </Pressable>
      {hasError ? (
        <Text selectable style={styles.error}>
          {props.error}
        </Text>
      ) : null}
    </View>
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
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.lg,
    ...theme.squircle,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  rowError: {
    borderColor: theme.colors.destructive,
  },
  icon: {
    width: theme.spacing["2xl"] + theme.spacing.md,
    height: theme.spacing["2xl"] + theme.spacing.md,
    borderRadius: theme.radii.md,
    ...theme.squircle,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.inputFill,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: theme.spacing["2xs"],
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  label: {
    flexShrink: 1,
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
    fontWeight: "500",
  },
  value: {
    color: theme.colors.foreground,
    fontSize: theme.typography.base.fontSize,
    lineHeight: theme.typography.base.lineHeight,
    fontWeight: "500",
  },
  placeholder: {
    color: theme.colors.icon.muted,
    fontSize: theme.typography.base.fontSize,
    lineHeight: theme.typography.base.lineHeight,
  },
  error: {
    marginTop: theme.spacing.xs,
    color: theme.colors.destructive,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
    fontWeight: "500",
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
}));
