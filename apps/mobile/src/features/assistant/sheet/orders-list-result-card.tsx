import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { Button, Card, StatusPill } from "../../../components/ui";
import type { AssistantOrdersListCardView } from "../surfaces";

/**
 * Live `orders_list_page` result (SHO-369). Composes Card / StatusPill.
 * Feature chrome — not the orders list screen or its virtualized row.
 * CTA opens `card.ctaHref` via `onOpenHref`.
 */
export const OrdersListResultCard = memo(function OrdersListResultCard(props: {
  readonly card: AssistantOrdersListCardView;
  readonly onOpenHref: (href: string) => void;
}) {
  const { card } = props;
  const showChips = card.chips.length > 0;
  const emptyTitle = card.emptyTitle;
  const emptyDescription = card.emptyDescription;
  const ctaLabel = card.ctaLabel;
  const ctaHref = card.ctaHref;

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
        {emptyTitle !== null ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{emptyTitle}</Text>
            {emptyDescription !== null ? (
              <Text style={styles.emptyDescription}>{emptyDescription}</Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.rows}>
            {card.rows.map((row) => (
              <ListResultRow
                key={row.orderId}
                href={row.href}
                customerName={row.customerName}
                statusLabel={row.statusLabel}
                statusTone={row.statusTone}
                metaLabel={row.metaLabel}
                totalLabel={row.totalLabel}
                onOpenHref={props.onOpenHref}
              />
            ))}
          </View>
        )}
        {card.footnotes.map((footnote) => (
          <Text key={footnote} style={styles.footnote}>
            {footnote}
          </Text>
        ))}
        {ctaLabel === null || ctaHref === null ? null : (
          <Button
            variant="secondary"
            fullWidth
            label={ctaLabel}
            onPress={() => {
              props.onOpenHref(ctaHref);
            }}
          />
        )}
      </View>
    </Card>
  );
});

const ListResultRow = memo(function ListResultRow(props: {
  readonly href: string;
  readonly customerName: string;
  readonly statusLabel: string | null;
  readonly statusTone: AssistantOrdersListCardView["rows"][number]["statusTone"];
  readonly metaLabel: string;
  readonly totalLabel: string | null;
  readonly onOpenHref: (href: string) => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        props.customerName.length > 0 ? props.customerName : props.metaLabel
      }
      onPress={() => {
        props.onOpenHref(props.href);
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
