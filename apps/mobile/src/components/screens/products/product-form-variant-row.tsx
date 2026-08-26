import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { PencilIcon } from "lucide-react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { StatusPill } from "../../ui";

/**
 * Canvas editor `VariantRow`: tap opens the variant sheet. Detail
 * rows use `ProductVariantRow` + `VariantActionsSheet` (SHO-152).
 */
export const ProductFormVariantRow = memo(
  function ProductFormVariantRow(props: {
    readonly id: string;
    readonly name: string;
    readonly priceLabel: string;
    readonly archived: boolean;
    readonly archivedLabel: string;
    readonly editLabel: string;
    readonly error: string | null;
    readonly disabled: boolean;
    readonly onPress: (id: string) => void;
  }) {
    const { theme } = useUnistyles();
    const hasError = props.error != null && props.error.length > 0;
    const accessibilityLabel = hasError
      ? `${props.name}. ${props.error}. ${props.editLabel}`
      : `${props.name}. ${props.editLabel}`;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        disabled={props.disabled}
        onPress={() => {
          props.onPress(props.id);
        }}
        style={({ pressed }) => [
          styles.row,
          pressed && !props.disabled ? styles.pressed : null,
        ]}
      >
        <View style={styles.body}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{props.name}</Text>
            {props.archived ? (
              <StatusPill label={props.archivedLabel} tone="neutral" />
            ) : null}
          </View>
          <Text numberOfLines={1} style={styles.price}>
            {props.priceLabel}
          </Text>
          {hasError ? <Text style={styles.error}>{props.error}</Text> : null}
        </View>
        <PencilIcon
          size={theme.iconSize.sm}
          color={theme.colors.mutedForeground}
        />
      </Pressable>
    );
  },
);

const styles = StyleSheet.create((theme) => ({
  row: {
    minHeight: theme.hitTarget.field + theme.spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
    ...theme.squircle,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: theme.spacing["2xs"],
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
  },
  name: {
    flexShrink: 1,
    color: theme.colors.foreground,
    fontSize: theme.typography.base.fontSize,
    lineHeight: theme.typography.base.lineHeight,
    fontWeight: "600",
  },
  price: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
  },
  error: {
    color: theme.colors.destructive,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
    fontWeight: "500",
  },
  pressed: {
    opacity: 0.85,
  },
}));
