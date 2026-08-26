import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

export function Button(props: {
  readonly label: string;
  readonly onPress: () => void;
  readonly loading?: boolean;
  readonly disabled?: boolean;
  readonly variant?: "primary" | "secondary" | "ghost" | "danger";
  readonly size?: "default" | "auth";
  readonly fullWidth?: boolean;
  readonly icon?: ReactNode;
}) {
  const variant = props.variant ?? "primary";
  const size = props.size ?? "default";
  const disabled = props.disabled === true || props.loading === true;
  const authDisabled = disabled && size === "auth" && variant === "primary";
  const { theme } = useUnistyles();
  const indicatorColor =
    variant === "primary"
      ? theme.colors.activityIndicator.onPrimary
      : variant === "danger"
        ? theme.colors.destructive
        : theme.colors.activityIndicator.onBackground;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      disabled={disabled}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.button,
        size === "auth" ? styles.buttonAuth : null,
        props.fullWidth === true ? styles.fullWidth : null,
        variant === "ghost"
          ? styles.ghost
          : variant === "secondary"
            ? styles.secondary
            : variant === "danger"
              ? styles.danger
              : styles.primary,
        authDisabled ? styles.disabledAuth : disabled ? styles.disabled : null,
        pressed && !disabled && variant === "danger"
          ? styles.dangerPressed
          : null,
        pressed && !disabled && variant !== "danger" ? styles.pressed : null,
      ]}
    >
      {({ pressed }) =>
        props.loading === true ? (
          <ActivityIndicator color={indicatorColor} />
        ) : (
          <View style={styles.content}>
            {props.icon}
            <Text
              style={
                variant === "ghost"
                  ? styles.ghostLabel
                  : variant === "secondary"
                    ? styles.secondaryLabel
                    : variant === "danger"
                      ? pressed && !disabled
                        ? styles.dangerPressedLabel
                        : styles.dangerLabel
                      : size === "auth"
                        ? styles.authLabel
                        : styles.label
              }
            >
              {props.label}
            </Text>
          </View>
        )
      }
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  button: {
    minHeight: theme.hitTarget.min,
    borderRadius: theme.radii.full,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.lg,
  },
  buttonAuth: {
    minHeight: theme.hitTarget.auth,
  },
  fullWidth: {
    width: "100%",
    alignSelf: "stretch",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
  },
  primary: {
    backgroundColor: theme.colors.primary,
  },
  secondary: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  ghost: {
    backgroundColor: "transparent",
  },
  danger: {
    backgroundColor: theme.colors.destructiveSoft,
  },
  dangerPressed: {
    backgroundColor: theme.colors.destructive,
  },
  disabled: {
    opacity: 0.5,
  },
  disabledAuth: {
    backgroundColor: theme.colors.icon.muted,
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    color: theme.colors.primaryForeground,
    fontSize: theme.typography.md.fontSize,
    lineHeight: theme.typography.md.lineHeight,
    fontWeight: "600",
  },
  secondaryLabel: {
    color: theme.colors.foreground,
    fontSize: theme.typography.md.fontSize,
    lineHeight: theme.typography.md.lineHeight,
    fontWeight: "600",
  },
  authLabel: {
    color: theme.colors.primaryForeground,
    fontSize: theme.typography.lg.fontSize,
    lineHeight: theme.typography.lg.lineHeight,
    fontWeight: "600",
  },
  ghostLabel: {
    color: theme.colors.primary,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
    fontWeight: "500",
  },
  dangerLabel: {
    color: theme.colors.destructive,
    fontSize: theme.typography.md.fontSize,
    lineHeight: theme.typography.md.lineHeight,
    fontWeight: "600",
  },
  dangerPressedLabel: {
    color: theme.colors.destructiveForeground,
    fontSize: theme.typography.md.fontSize,
    lineHeight: theme.typography.md.lineHeight,
    fontWeight: "600",
  },
}));
