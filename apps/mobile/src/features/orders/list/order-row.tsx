import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronRightIcon } from "lucide-react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { StatusPill } from "../../../components/ui";
import type { OrderStatusTone } from "./orders-list.presenter";

/**
 * Canvas `OrderRow` minus omitted extras (`#number`, due date, payment
 * and delivery chips). Primitive props keep `memo` effective in the
 * virtualized list; the shared `onPress` takes the row id.
 */
export const OrderRow = memo(function OrderRow(props: {
  readonly id: string;
  readonly customerName: string;
  readonly customerNamePending: boolean;
  readonly statusLabel: string;
  readonly statusTone: OrderStatusTone;
  readonly metaLabel: string;
  readonly totalLabel: string;
  readonly onPress: (id: string) => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        props.customerNamePending ? props.metaLabel : props.customerName
      }
      onPress={() => {
        props.onPress(props.id);
      }}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
    >
      <View style={styles.body}>
        <View style={styles.nameRow}>
          {props.customerNamePending ? (
            <View
              style={[styles.skeletonLine, styles.skeletonName]}
              accessibilityElementsHidden
            />
          ) : (
            <Text numberOfLines={1} style={styles.name}>
              {props.customerName}
            </Text>
          )}
          <StatusPill label={props.statusLabel} tone={props.statusTone} />
        </View>
        <Text numberOfLines={1} style={styles.meta}>
          {props.metaLabel}
        </Text>
      </View>
      <Text numberOfLines={1} style={styles.total}>
        {props.totalLabel}
      </Text>
      <ChevronIcon />
    </Pressable>
  );
});

function ChevronIcon() {
  const { theme } = useUnistyles();
  return (
    <ChevronRightIcon
      size={theme.iconSize.sm}
      color={theme.colors.icon.muted}
    />
  );
}

export function OrderRowSkeleton() {
  return (
    <View style={styles.card} accessibilityElementsHidden>
      <View style={styles.body}>
        <View style={[styles.skeletonLine, styles.skeletonName]} />
        <View style={[styles.skeletonLine, styles.skeletonMeta]} />
      </View>
      <View style={[styles.skeletonLine, styles.skeletonTotal]} />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    minHeight: theme.hitTarget.row,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    // Class B: canvas rounded-[20px] → radii.xl. Card primitive is 22.
    borderRadius: theme.radii.xl,
    ...theme.squircle,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    ...theme.shadows.sm,
  },
  pressed: {
    opacity: 0.85,
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
  meta: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
  },
  total: {
    color: theme.colors.foreground,
    fontSize: theme.typography.base.fontSize,
    lineHeight: theme.typography.base.lineHeight,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  skeletonLine: {
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.skeleton,
  },
  skeletonName: {
    height: theme.spacing.lg,
    width: "66%",
  },
  skeletonMeta: {
    height: theme.spacing.md,
    width: "50%",
  },
  skeletonTotal: {
    height: theme.spacing.lg,
    width: 64,
  },
}));
