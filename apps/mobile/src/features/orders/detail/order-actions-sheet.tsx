import { Pressable, Text, View } from "react-native";
import { BanIcon } from "lucide-react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import type { OrdersDetailCopy } from "../../../i18n/orders";
import { Sheet } from "../../../components/ui";

/**
 * Canvas `Швидкі дії` minus omitted extras (mark paid / shipped).
 * Cancel is the only action; already canceled stays visible and disabled.
 */
export function OrderActionsSheet(props: {
  readonly visible: boolean;
  readonly copy: OrdersDetailCopy;
  readonly closeLabel: string;
  readonly cancelEnabled: boolean;
  readonly pending: boolean;
  readonly onClose: () => void;
  readonly onCancel: () => void;
}) {
  const { theme } = useUnistyles();
  const disabled = !props.cancelEnabled || props.pending;
  return (
    <Sheet
      visible={props.visible}
      title={props.copy.actionsTitle}
      closeAccessibilityLabel={props.closeLabel}
      onClose={props.onClose}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={props.copy.cancelOrder}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={props.onCancel}
        style={({ pressed }) => [
          styles.action,
          disabled ? styles.disabled : null,
          pressed && !disabled ? styles.pressed : null,
        ]}
      >
        <View style={styles.iconWell}>
          <BanIcon size={theme.iconSize.sm} color={theme.colors.destructive} />
        </View>
        <Text style={styles.dangerLabel}>{props.copy.cancelOrder}</Text>
      </Pressable>
    </Sheet>
  );
}

const styles = StyleSheet.create((theme) => ({
  action: {
    minHeight: theme.hitTarget.field,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    borderRadius: theme.radii.lg,
    ...theme.squircle,
    paddingHorizontal: theme.spacing.lg,
  },
  iconWell: {
    width: theme.spacing["3xl"] + theme.spacing.sm,
    height: theme.spacing["3xl"] + theme.spacing.sm,
    borderRadius: theme.radii.md,
    ...theme.squircle,
    backgroundColor: theme.colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerLabel: {
    flex: 1,
    color: theme.colors.destructive,
    fontSize: theme.typography.base.fontSize,
    lineHeight: theme.typography.base.lineHeight,
    fontWeight: "500",
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.85,
  },
}));
