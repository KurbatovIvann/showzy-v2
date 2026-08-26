import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronRightIcon } from "lucide-react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { StatusPill } from "../../ui";
import { ProductThumbnail } from "./product-thumbnail";

/**
 * Canvas `ProductRow`: card row with thumbnail, name (+ archived pill),
 * variant count, price, and a trailing chevron. Primitive props keep
 * `memo` effective in the virtualized list; the shared `onPress` takes
 * the row id.
 */
export const ProductRow = memo(function ProductRow(props: {
  readonly id: string;
  readonly name: string;
  readonly priceLabel: string;
  readonly archived: boolean;
  readonly archivedLabel: string;
  readonly variantsLabel: string;
  readonly thumbnailFileId: string | null;
  readonly thumbnailUrl: string | null;
  readonly onPress: (id: string) => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.name}
      onPress={() => {
        props.onPress(props.id);
      }}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
    >
      <ProductThumbnail
        fileId={props.thumbnailFileId}
        url={props.thumbnailUrl}
      />
      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text numberOfLines={2} style={styles.name}>
            {props.name}
          </Text>
          {props.archived ? (
            <StatusPill label={props.archivedLabel} tone="neutral" />
          ) : null}
        </View>
        <Text numberOfLines={1} style={styles.variants}>
          {props.variantsLabel}
        </Text>
        <Text numberOfLines={1} style={styles.price}>
          {props.priceLabel}
        </Text>
      </View>
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

export function ProductRowSkeleton() {
  return (
    <View style={styles.card} accessibilityElementsHidden>
      <View style={styles.skeletonThumbnail} />
      <View style={styles.body}>
        <View style={[styles.skeletonLine, styles.skeletonName]} />
        <View style={[styles.skeletonLine, styles.skeletonVariants]} />
        <View style={[styles.skeletonLine, styles.skeletonPrice]} />
      </View>
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
    // Canvas 15 / 13 / 16 → base / xs / md.
    fontSize: theme.typography.base.fontSize,
    lineHeight: theme.typography.base.lineHeight,
    fontWeight: "600",
  },
  variants: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
  },
  price: {
    color: theme.colors.foreground,
    fontSize: theme.typography.md.fontSize,
    lineHeight: theme.typography.md.lineHeight,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  skeletonThumbnail: {
    width: theme.hitTarget.field,
    height: theme.hitTarget.field,
    borderRadius: theme.radii.lg,
    ...theme.squircle,
    backgroundColor: theme.colors.skeleton,
  },
  skeletonLine: {
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.skeleton,
  },
  skeletonName: {
    height: theme.spacing.lg,
    width: "66%",
  },
  skeletonVariants: {
    height: theme.spacing.md,
    width: "50%",
  },
  skeletonPrice: {
    height: theme.spacing.lg,
    width: "25%",
  },
}));
