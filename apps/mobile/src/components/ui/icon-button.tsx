import type { ReactNode } from "react";
import { Pressable } from "react-native";
import { StyleSheet } from "react-native-unistyles";

/**
 * Canvas round icon control (header back chevron, header plus): a 44pt
 * circle. `primary` is the ink fill; `secondary` is the bordered card
 * fill (same visual role as Button secondary). Callers size and color
 * the icon (`theme.colors.primaryForeground` on primary,
 * `theme.colors.foreground` on secondary).
 */
export function IconButton(props: {
  readonly icon: ReactNode;
  readonly accessibilityLabel: string;
  readonly onPress: () => void;
  readonly variant?: "primary" | "secondary";
  readonly disabled?: boolean;
}) {
  const variant = props.variant ?? "primary";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel}
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.button,
        VARIANT_CHROME[variant],
        pressed ? styles.pressed : null,
      ]}
    >
      {props.icon}
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  button: {
    width: theme.hitTarget.min,
    height: theme.hitTarget.min,
    borderRadius: theme.radii.full,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: {
    backgroundColor: theme.colors.primary,
  },
  secondary: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  pressed: {
    opacity: theme.pressedOpacity,
  },
}));

const VARIANT_CHROME = {
  primary: styles.primary,
  secondary: styles.secondary,
} as const;
