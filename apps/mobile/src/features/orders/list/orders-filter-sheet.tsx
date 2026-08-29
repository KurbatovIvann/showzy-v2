import { Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { Button, Sheet } from "../../../components/ui";
import type { OrdersCopy } from "../../../i18n/orders";
import {
  ORDER_STATUS_FILTERS,
  type OrderStatusFilter,
} from "./orders-list.presenter";

/**
 * Canvas `OrdersFilterSheet` minus the payment section (SHO-208 owner
 * decision 2). Status chips are multi-select; empty selection means all.
 */
export function OrdersFilterSheet(props: {
  readonly visible: boolean;
  readonly copy: OrdersCopy;
  readonly selected: readonly OrderStatusFilter[];
  readonly onClose: () => void;
  readonly onToggle: (status: OrderStatusFilter) => void;
  readonly onReset: () => void;
}) {
  return (
    <Sheet
      visible={props.visible}
      title={props.copy.filterTitle}
      closeAccessibilityLabel={props.copy.closeSheet}
      onClose={props.onClose}
      footer={
        <View style={styles.footer}>
          <Button
            variant="secondary"
            label={props.copy.filterReset}
            onPress={props.onReset}
          />
          <View style={styles.apply}>
            <Button
              fullWidth
              label={props.copy.filterApply}
              onPress={props.onClose}
            />
          </View>
        </View>
      }
    >
      <Text style={styles.section}>{props.copy.filterStatus}</Text>
      <View style={styles.chips}>
        {ORDER_STATUS_FILTERS.map((status) => {
          const selected = props.selected.includes(status);
          return (
            <Pressable
              key={status}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={props.copy.statuses[status]}
              onPress={() => {
                props.onToggle(status);
              }}
              style={({ pressed }) => [
                styles.chip,
                selected ? styles.chipSelected : null,
                pressed && !selected ? styles.pressed : null,
              ]}
            >
              <Text
                style={selected ? styles.chipLabelSelected : styles.chipLabel}
              >
                {props.copy.statuses[status]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create((theme) => ({
  section: {
    color: theme.colors.icon.muted,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  chip: {
    minHeight: theme.hitTarget.min,
    justifyContent: "center",
    borderRadius: theme.radii.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    paddingHorizontal: theme.spacing.lg,
  },
  chipSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  chipLabel: {
    color: theme.colors.foreground,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
    fontWeight: "500",
  },
  chipLabelSelected: {
    color: theme.colors.primaryForeground,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
    fontWeight: "500",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  apply: {
    flex: 1,
  },
  pressed: {
    opacity: 0.85,
  },
}));
