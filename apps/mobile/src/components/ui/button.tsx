import { ActivityIndicator, Pressable, Text } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

export function Button(props: {
  readonly label: string;
  readonly onPress: () => void;
  readonly loading?: boolean;
  readonly disabled?: boolean;
  readonly variant?: "primary" | "secondary" | "ghost";
  readonly size?: "default" | "auth";
}) {
  const variant = props.variant ?? "primary";
  const size = props.size ?? "default";
  const disabled = props.disabled === true || props.loading === true;
  const authDisabled = disabled && size === "auth" && variant === "primary";
  const { theme } = useUnistyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      disabled={disabled}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.button,
        size === "auth" ? styles.buttonAuth : null,
        variant === "ghost"
          ? styles.ghost
          : variant === "secondary"
            ? styles.secondary
            : styles.primary,
        authDisabled ? styles.disabledAuth : disabled ? styles.disabled : null,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {props.loading === true ? (
        <ActivityIndicator
          color={
            variant === "primary"
              ? theme.colors.activityIndicator.onPrimary
              : theme.colors.activityIndicator.onBackground
          }
        />
      ) : (
        <Text
          style={
            variant === "ghost"
              ? styles.ghostLabel
              : variant === "secondary"
                ? styles.secondaryLabel
                : size === "auth"
                  ? styles.authLabel
                  : styles.label
          }
        >
          {props.label}
        </Text>
      )}
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
}));
