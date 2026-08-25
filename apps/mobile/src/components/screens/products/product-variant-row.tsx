import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { StatusPill } from "../../ui";

/**
 * One variant row on the product detail: name, effective price (override
 * or inherited base, labeled), archived pill, and archive/restore.
 */
export const ProductVariantRow = memo(function ProductVariantRow(props: {
  readonly id: string;
  readonly name: string;
  readonly priceLabel: string;
  readonly priceInherited: boolean;
  readonly inheritedLabel: string;
  readonly archived: boolean;
  readonly archivedLabel: string;
  readonly archiveLabel: string;
  readonly restoreLabel: string;
  readonly actionAccessibilityLabel: string;
  readonly canEdit: boolean;
  readonly onArchive: (id: string, name: string) => void;
  readonly onRestore: (id: string, name: string) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text numberOfLines={2} style={styles.name}>
            {props.name}
          </Text>
          {props.archived ? (
            <StatusPill label={props.archivedLabel} tone="neutral" />
          ) : null}
        </View>
        <Text numberOfLines={1} style={styles.price}>
          {props.priceLabel}
        </Text>
        {props.priceInherited ? (
          <Text numberOfLines={1} style={styles.inherited}>
            {props.inheritedLabel}
          </Text>
        ) : null}
      </View>
      {props.canEdit ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={props.actionAccessibilityLabel}
          onPress={() => {
            if (props.archived) {
              props.onRestore(props.id, props.name);
            } else {
              props.onArchive(props.id, props.name);
            }
          }}
          style={({ pressed }) => [
            styles.action,
            pressed ? styles.pressed : null,
          ]}
        >
          <Text
            style={props.archived ? styles.restoreLabel : styles.archiveLabel}
          >
            {props.archived ? props.restoreLabel : props.archiveLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create((theme) => ({
  row: {
    minHeight: theme.hitTarget.row,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.xl,
    ...theme.squircle,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    ...theme.shadows.sm,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: theme.spacing.xs,
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
    color: theme.colors.foreground,
    fontSize: theme.typography.md.fontSize,
    lineHeight: theme.typography.md.lineHeight,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  inherited: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
  },
  action: {
    minHeight: theme.hitTarget.min,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.sm,
  },
  archiveLabel: {
    color: theme.colors.destructive,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
    fontWeight: "600",
  },
  restoreLabel: {
    color: theme.colors.foreground,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.85,
  },
}));
