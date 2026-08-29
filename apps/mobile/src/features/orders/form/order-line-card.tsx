import { Pressable, Text, View } from "react-native";
import { PackageIcon, Trash2Icon } from "lucide-react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { interpolate } from "../../../i18n/locale";
import type { OrdersCreateCopy } from "../../../i18n/orders";
import {
  formatOrderLineQuantity,
  type OrderFormLineDraft,
} from "./order-form-draft";
import { QuantityStepper } from "./quantity-stepper";

export function OrderLineCard(props: {
  readonly item: OrderFormLineDraft;
  readonly copy: OrdersCreateCopy;
  readonly editable: boolean;
  readonly onStep: (deltaUnits: number) => void;
  readonly onRemove: () => void;
}) {
  const { theme } = useUnistyles();
  const { item, copy } = props;
  const variantName =
    item.variantName != null && item.variantName.length > 0
      ? item.variantName
      : null;
  const removeLabel = interpolate(copy.removeLine, { name: item.productName });

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.thumb}>
          <PackageIcon
            size={theme.iconSize.sm}
            color={theme.colors.mutedForeground}
          />
        </View>
        <View style={styles.body}>
          <Text style={styles.name}>{item.productName}</Text>
          {variantName !== null ? (
            <Text style={styles.variant}>{variantName}</Text>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={removeLabel}
          disabled={!props.editable}
          onPress={props.onRemove}
          style={({ pressed }) => [
            styles.remove,
            pressed && props.editable ? styles.pressed : null,
          ]}
        >
          <Trash2Icon
            size={theme.iconSize.sm}
            color={theme.colors.destructive}
          />
        </Pressable>
      </View>
      <View style={styles.bottom}>
        <QuantityStepper
          valueLabel={formatOrderLineQuantity(item.quantityMilli)}
          decreaseLabel={copy.qtyDecrease}
          increaseLabel={copy.qtyIncrease}
          disabled={!props.editable}
          onDecrease={() => {
            props.onStep(-1);
          }}
          onIncrease={() => {
            props.onStep(1);
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.xl,
    ...theme.squircle,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
    ...theme.shadows.sm,
  },
  top: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.md,
  },
  thumb: {
    width: theme.spacing["2xl"] + theme.spacing.sm,
    height: theme.spacing["2xl"] + theme.spacing.sm,
    borderRadius: theme.radii.md,
    ...theme.squircle,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.inputFill,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: theme.spacing["2xs"],
  },
  name: {
    color: theme.colors.foreground,
    fontSize: theme.typography.base.fontSize,
    lineHeight: theme.typography.base.lineHeight,
    fontWeight: "600",
  },
  variant: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
  },
  remove: {
    width: theme.hitTarget.min,
    height: theme.hitTarget.min,
    borderRadius: theme.radii.full,
    borderWidth: 1,
    borderColor: theme.colors.destructiveSoft,
    backgroundColor: theme.colors.destructiveSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  bottom: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
  },
  pressed: {
    opacity: 0.85,
  },
}));
