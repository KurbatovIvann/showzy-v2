import { Pressable, Text, View } from "react-native";
import { MinusIcon, PlusIcon } from "lucide-react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

export function QuantityStepper(props: {
  readonly valueLabel: string;
  readonly decreaseLabel: string;
  readonly increaseLabel: string;
  readonly disabled?: boolean;
  readonly onDecrease: () => void;
  readonly onIncrease: () => void;
}) {
  const { theme } = useUnistyles();
  const disabled = props.disabled === true;
  const iconColor = theme.colors.foreground;

  return (
    <View style={styles.track}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={props.decreaseLabel}
        disabled={disabled}
        onPress={props.onDecrease}
        style={({ pressed }) => [
          styles.hit,
          pressed && !disabled ? styles.pressed : null,
        ]}
      >
        <MinusIcon size={theme.iconSize.sm} color={iconColor} />
      </Pressable>
      <Text style={styles.value}>{props.valueLabel}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={props.increaseLabel}
        disabled={disabled}
        onPress={props.onIncrease}
        style={({ pressed }) => [
          styles.hit,
          pressed && !disabled ? styles.pressed : null,
        ]}
      >
        <PlusIcon size={theme.iconSize.sm} color={iconColor} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  track: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.full,
  },
  hit: {
    width: theme.hitTarget.min,
    height: theme.hitTarget.min,
    alignItems: "center",
    justifyContent: "center",
  },
  value: {
    minWidth: theme.spacing["2xl"] + theme.spacing.sm,
    textAlign: "center",
    color: theme.colors.foreground,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  pressed: {
    opacity: 0.85,
  },
}));
