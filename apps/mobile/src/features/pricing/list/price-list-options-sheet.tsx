import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { PowerIcon, StarIcon, Trash2Icon } from "lucide-react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { Sheet } from "../../../components/ui";
import type { PricingCopy } from "../../../i18n/pricing";
import { priceListOptionVisibility } from "./price-lists-list.presenter";
import type { PriceListsListRow } from "./use-price-lists-list";

export function PriceListOptionsSheet(props: {
  readonly visible: boolean;
  readonly list: PriceListsListRow | null;
  readonly copy: PricingCopy;
  readonly canManage: boolean;
  readonly onClose: () => void;
  readonly onSetDefault: () => void;
  readonly onToggleActive: () => void;
  readonly onDelete: () => void;
}) {
  const { theme } = useUnistyles();
  const list = props.list;
  const visibility =
    list === null
      ? priceListOptionVisibility({
          canManage: false,
          isDefault: false,
          isActive: false,
        })
      : priceListOptionVisibility({
          canManage: props.canManage,
          isDefault: list.isDefault,
          isActive: list.isActive,
        });
  const muted = theme.colors.mutedForeground;
  const danger = theme.colors.destructive;
  const icon = theme.iconSize.sm;
  const showDefault =
    visibility.showSetDefault || visibility.showClearDefault;
  const showActive = visibility.showActivate || visibility.showDeactivate;
  const showDelete = visibility.showDelete;

  return (
    <Sheet
      visible={props.visible}
      title={list?.name ?? props.copy.options.close}
      closeAccessibilityLabel={props.copy.options.close}
      onClose={props.onClose}
    >
      <View style={styles.group}>
        {showDefault ? (
          <OptionRow
            icon={<StarIcon size={icon} color={muted} />}
            label={
              visibility.showClearDefault
                ? props.copy.options.clearDefault
                : props.copy.options.setDefault
            }
            last={!showActive && !showDelete}
            onPress={props.onSetDefault}
          />
        ) : null}
        {showActive ? (
          <OptionRow
            icon={<PowerIcon size={icon} color={muted} />}
            label={
              visibility.showDeactivate
                ? props.copy.options.deactivate
                : props.copy.options.activate
            }
            last={!showDelete}
            onPress={props.onToggleActive}
          />
        ) : null}
        {showDelete ? (
          <OptionRow
            icon={<Trash2Icon size={icon} color={danger} />}
            label={props.copy.options.delete}
            danger
            last
            onPress={props.onDelete}
          />
        ) : null}
      </View>
    </Sheet>
  );
}

function OptionRow(props: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly onPress: () => void;
  readonly danger?: boolean;
  readonly last?: boolean;
}) {
  const danger = props.danger === true;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.row,
        props.last === true ? styles.rowLast : null,
        pressed ? styles.pressed : null,
      ]}
    >
      {props.icon}
      <Text style={danger ? styles.dangerLabel : styles.label}>
        {props.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  group: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.xl,
    ...theme.squircle,
    backgroundColor: theme.colors.background,
  },
  row: {
    minHeight: theme.hitTarget.field,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  label: {
    flex: 1,
    color: theme.colors.foreground,
    fontSize: theme.typography.base.fontSize,
    lineHeight: theme.typography.base.lineHeight,
    fontWeight: "500",
  },
  dangerLabel: {
    flex: 1,
    color: theme.colors.destructive,
    fontSize: theme.typography.base.fontSize,
    lineHeight: theme.typography.base.lineHeight,
    fontWeight: "500",
  },
  pressed: {
    opacity: 0.85,
  },
}));
