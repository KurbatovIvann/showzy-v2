import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { Card, StatusPill } from "../../../components/ui";
import type { AssistantOrderEntityCardView } from "../surfaces";

/**
 * Thin live `orders.get` / `orders.create` card (SHO-369). T4 hydrates
 * the same card. Parent 2 may grow «Підтвердити» later.
 */
export const OrderEntityCard = memo(function OrderEntityCard(props: {
  readonly card: AssistantOrderEntityCardView;
  readonly onOpenHref: (href: string) => void;
}) {
  const { card } = props;
  const title =
    card.orderNumberLabel.length > 0 ? card.orderNumberLabel : card.orderId;
  const accessibilityLabel =
    card.customerName !== null && card.customerName.length > 0
      ? card.customerName
      : title;

  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={() => {
          props.onOpenHref(card.href);
        }}
        style={({ pressed }) => [styles.body, pressed ? styles.pressed : null]}
      >
        <View style={styles.titleRow}>
          <Text numberOfLines={1} style={styles.title}>
            {title}
          </Text>
          {card.statusLabel !== null ? (
            <StatusPill label={card.statusLabel} tone={card.statusTone} />
          ) : null}
        </View>
        {card.customerName !== null ? (
          <Text numberOfLines={1} style={styles.customer}>
            {card.customerName}
          </Text>
        ) : null}
        {card.totalLabel !== null ? (
          <Text numberOfLines={1} style={styles.total}>
            {card.totalLabel}
          </Text>
        ) : null}
      </Pressable>
    </Card>
  );
});

const styles = StyleSheet.create((theme) => ({
  body: {
    gap: theme.spacing.xs,
  },
  pressed: {
    opacity: theme.pressedOpacity,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
  },
  title: {
    flexShrink: 1,
    color: theme.colors.foreground,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
    fontWeight: "600",
  },
  customer: {
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
}));
