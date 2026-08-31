import { Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

/**
 * Canvas `ProductSwitchRow`: label + optional description and a 44pt
 * switch control. Shared — first used by the product variant sheet
 * (SHO-150); later pricing/customers screens reuse this, not a fork.
 */
export function SwitchRow(props: {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly description?: string;
  readonly disabled?: boolean;
}) {
  const disabled = props.disabled === true;
  const description =
    props.description != null && props.description.length > 0
      ? props.description
      : null;

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={props.label}
      accessibilityState={{ checked: props.checked, disabled }}
      disabled={disabled}
      onPress={() => {
        props.onChange(!props.checked);
      }}
      style={({ pressed }) => [
        styles.row,
        pressed && !disabled ? styles.pressed : null,
      ]}
    >
      <View style={styles.copy}>
        <Text style={styles.label}>{props.label}</Text>
        {description !== null ? (
          <Text style={styles.description}>{description}</Text>
        ) : null}
      </View>
      <View
        style={[styles.track, props.checked ? styles.trackOn : styles.trackOff]}
      >
        <View
          style={[
            styles.thumb,
            props.checked ? styles.thumbOn : styles.thumbOff,
          ]}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    minHeight: theme.hitTarget.min,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.lg,
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
  track: {
    width: theme.spacing["3xl"] + theme.spacing["2xl"],
    height: theme.spacing["2xl"] + theme.spacing.sm,
    borderRadius: theme.radii.full,
    justifyContent: "center",
  },
  trackOn: {
    backgroundColor: theme.colors.success,
  },
  trackOff: {
    backgroundColor: theme.colors.border,
  },
  thumb: {
    width: theme.spacing["2xl"],
    height: theme.spacing["2xl"],
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.card,
    ...theme.shadows.sm,
  },
  thumbOff: {
    marginLeft: theme.spacing.xs,
  },
  thumbOn: {
    marginLeft: theme.spacing["2xl"] + theme.spacing.xs,
  },
  pressed: {
    opacity: theme.pressedOpacity,
  },
}));
