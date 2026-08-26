import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { PencilIcon } from "lucide-react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { StatusPill } from "../../ui";

/**
 * Canvas editor `VariantRow`: tap opens the variant sheet. Not the
 * detail-row archive control (SHO-152).
 */
export const ProductFormVariantRow = memo(
  function ProductFormVariantRow(props: {
    readonly id: string;
    readonly name: string;
    readonly priceLabel: string;
    readonly archived: boolean;
    readonly archivedLabel: string;
    readonly editLabel: string;
    readonly disabled: boolean;
    readonly onPress: (id: string) => void;
  }) {
    const { theme } = useUnistyles();
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${props.name}. ${props.editLabel}`}
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
  pressed: {
    opacity: 0.85,
  },
}));
