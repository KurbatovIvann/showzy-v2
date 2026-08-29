import { memo } from "react";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { OrderThumbnail } from "../shared/order-thumbnail";

/**
 * Immutable line snapshot (title, unit × qty, gross) plus a catalog
 * primary-image thumbnail. Primitive props keep `memo` effective; never
 * recomputes price from catalog or `basePriceMinor`.
 */
export const OrderLineRow = memo(function OrderLineRow(props: {
  readonly title: string;
  readonly metaLabel: string;
  readonly grossLabel: string;
  readonly thumbnailFileId: string | null;
  readonly thumbnailUrl: string | null;
  readonly thumbnailFailed: boolean;
  readonly thumbnailFailedLabel: string;
}) {
  return (
    <View style={styles.row}>
      <OrderThumbnail
        fileId={props.thumbnailFileId}
        url={props.thumbnailUrl}
        failed={props.thumbnailFailed}
        failedLabel={props.thumbnailFailedLabel}
      />
      <View style={styles.body}>
        <Text style={styles.title}>{props.title}</Text>
        <Text style={styles.meta}>{props.metaLabel}</Text>
      </View>
      <Text style={styles.gross}>{props.grossLabel}</Text>
    </View>
  );
});

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.md,
    backgroundColor: theme.colors.background,
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
  title: {
    color: theme.colors.foreground,
    fontSize: theme.typography.base.fontSize,
    lineHeight: theme.typography.base.lineHeight,
  },
  meta: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
  },
  gross: {
    flexShrink: 0,
    color: theme.colors.foreground,
    fontSize: theme.typography.base.fontSize,
    lineHeight: theme.typography.base.lineHeight,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
}));
