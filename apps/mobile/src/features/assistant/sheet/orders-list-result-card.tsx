import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { Button, Card, StatusPill } from "../../../components/ui";
import type { AssistantOrdersListCardView } from "../shared/result-cards";

/**
 * Live `orders_list_page` result (SHO-369). Composes Card / StatusPill.
 * Feature chrome — not the orders list screen or its virtualized row.
 * CTA opens `/orders`.
 */
export const OrdersListResultCard = memo(function OrdersListResultCard(props: {
  readonly card: AssistantOrdersListCardView;
  readonly onOpenOrders: () => void;
  readonly onOpenOrder: (orderId: string) => void;
}) {
  const { card } = props;
  const showChips = card.chips.length > 0;
  const showEmpty = card.emptyTitle !== null;
  const showCta = card.ctaLabel !== null && card.ctaHref !== null;

  return (
    <Card>
      <View style={styles.body}>
        {showChips ? (
          <View style={styles.chips}>
            {card.chips.map((chip) => (
              <StatusPill
                key={chip.status}
                label={chip.label}
                tone={chip.tone}
              />
            ))}
          </View>
        ) : null}
        {showEmpty ? (
          <View style={styles.empty}>
            {card.emptyTitle !== null ? (
              <Text style={styles.emptyTitle}>{card.emptyTitle}</Text>
            ) : null}
            {card.emptyDescription !== null ? (
              <Text style={styles.emptyDescription}>
                {card.emptyDescription}
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.rows}>
            {card.rows.map((row) => (
              <ListResultRow
                key={row.orderId}
                orderId={row.orderId}
                customerName={row.customerName}
                statusLabel={row.statusLabel}
                statusTone={row.statusTone}
                metaLabel={row.metaLabel}
                totalLabel={row.totalLabel}
                onOpenOrder={props.onOpenOrder}
              />
            ))}
          </View>
        )}
        {card.footnotes.map((footnote) => (
          <Text key={footnote} style={styles.footnote}>
            {footnote}
          </Text>
        ))}
        {showCta ? (
          <Button
            variant="secondary"
            fullWidth
            label={card.ctaLabel ?? ""}
            onPress={props.onOpenOrders}
          />
        ) : null}
      </View>
    </Card>
  );
});

const ListResultRow = memo(function ListResultRow(props: {
  readonly orderId: string;
  readonly customerName: string;
  readonly statusLabel: string | null;
  readonly statusTone: AssistantOrdersListCardView["rows"][number]["statusTone"];
  readonly metaLabel: string;
  readonly totalLabel: string | null;
  readonly onOpenOrder: (orderId: string) => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        props.customerName.length > 0 ? props.customerName : props.metaLabel
      }
      onPress={() => {
        props.onOpenOrder(props.orderId);
      }}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      <View style={styles.rowBody}>
        <View style={styles.nameRow}>
          <Text numberOfLines={1} style={styles.name}>
            {props.customerName}
          </Text>
          {props.statusLabel !== null ? (
            <StatusPill label={props.statusLabel} tone={props.statusTone} />
          ) : null}
        </View>
        {props.metaLabel.length > 0 ? (
          <Text numberOfLines={1} style={styles.meta}>
            {props.metaLabel}
          </Text>
        ) : null}
      </View>
      {props.totalLabel !== null ? (
        <Text numberOfLines={1} style={styles.total}>
          {props.totalLabel}
        </Text>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create((theme) => ({
  body: {
    gap: theme.spacing.md,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
  },
  rows: {
    gap: theme.spacing.xs,
  },
  row: {
    minHeight: theme.hitTarget.min,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  pressed: {
    opacity: theme.pressedOpacity,
  },
  rowBody: {
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
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
    fontWeight: "600",
  },
  meta: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
  },
  total: {
    color: theme.colors.foreground,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  empty: {
    gap: theme.spacing.xs,
  },
  emptyTitle: {
    color: theme.colors.foreground,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
    fontWeight: "600",
  },
  emptyDescription: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
  },
  footnote: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
  },
}));
