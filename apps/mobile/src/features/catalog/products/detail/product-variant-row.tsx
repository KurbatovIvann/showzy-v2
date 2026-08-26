import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronRightIcon } from "lucide-react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { StatusPill } from "../../../../components/ui";

/**
 * Canvas detail `VariantRow`: tap opens VariantActionsSheet. Editor
 * rows with a pencil live in `product-form-variant-row.tsx`.
 */
export const ProductVariantRow = memo(function ProductVariantRow(props: {
  readonly id: string;
  readonly name: string;
  readonly priceLabel: string;
  readonly archived: boolean;
  readonly archivedLabel: string;
  readonly accessibilityLabel: string;
  readonly canEdit: boolean;
  readonly onPress: (id: string) => void;
}) {
  const { theme } = useUnistyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel}
      disabled={!props.canEdit}
      onPress={() => {
        props.onPress(props.id);
      }}
      style={({ pressed }) => [
        styles.row,
        pressed && props.canEdit ? styles.pressed : null,
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
      </View>
      {props.canEdit ? (
        <ChevronRightIcon
          size={theme.iconSize.sm}
          color={theme.colors.icon.muted}
        />
      ) : null}
    </Pressable>
  );
});

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
  pressed: {
    opacity: 0.85,
  },
}));
