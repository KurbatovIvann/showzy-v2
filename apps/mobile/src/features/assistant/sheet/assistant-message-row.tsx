import { memo, type ReactNode } from "react";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import {
  assistantTurnColumnLayout,
  assistantTurnResultStretch,
} from "../shared/assistant-turn-layout";
import type { AssistantTimelineStep } from "../shared/chat-rows";
import type {
  AssistantOrderEntityCardView,
  AssistantOrdersAggregateCardView,
  AssistantOrdersListCardView,
} from "../shared/result-cards";
import { AssistantTimeline } from "./assistant-timeline";
import { ConfirmationCard } from "./confirmation-card";
import { OrderEntityCard } from "./order-entity-card";
import { OrdersAggregateResultCard } from "./orders-aggregate-result-card";
import { OrdersListResultCard } from "./orders-list-result-card";

export const AssistantMessageRow = memo(function AssistantMessageRow(props: {
  readonly role: "user" | "assistant";
  readonly text: string;
  readonly timeline: readonly AssistantTimelineStep[];
  readonly timelineLabel: string;
  readonly listCard: AssistantOrdersListCardView | null;
  readonly aggregateCard: AssistantOrdersAggregateCardView | null;
  readonly entityCards: readonly AssistantOrderEntityCardView[];
  readonly onOpenOrders: () => void;
  readonly onOpenOrder: (orderId: string) => void;
  readonly confirmationSummary: string | null;
  readonly confirmationTitle: string;
  readonly confirmLabel: string;
  readonly dismissLabel: string;
  readonly confirmingLabel: string;
  readonly confirmationApplying: boolean;
  readonly onConfirm: () => void;
  readonly onDismiss: () => void;
}) {
  const isUser = props.role === "user";
  const confirmationSummary = props.confirmationSummary;
  const showTimeline = props.timeline.length > 0;
  const listCard = props.listCard;
  const aggregateCard = props.aggregateCard;

  return (
    <View style={isUser ? styles.userWrap : styles.assistantWrap}>
      {props.text.length > 0 ? (
        <Text style={isUser ? styles.userBubble : styles.assistantBubble}>
          {props.text}
        </Text>
      ) : null}
      {showTimeline ? (
        <AssistantTurnResult>
          <AssistantTimeline
            steps={props.timeline}
            accessibilityLabel={props.timelineLabel}
          />
        </AssistantTurnResult>
      ) : null}
      {listCard !== null ? (
        <AssistantTurnResult>
          <OrdersListResultCard
            card={listCard}
            onOpenOrders={props.onOpenOrders}
            onOpenOrder={props.onOpenOrder}
          />
        </AssistantTurnResult>
      ) : null}
      {aggregateCard !== null ? (
        <AssistantTurnResult>
          <OrdersAggregateResultCard card={aggregateCard} />
        </AssistantTurnResult>
      ) : null}
      {props.entityCards.map((card) => (
        <AssistantTurnResult key={card.id}>
          <OrderEntityCard card={card} onOpenOrder={props.onOpenOrder} />
        </AssistantTurnResult>
      ))}
      {confirmationSummary !== null ? (
        <AssistantTurnResult>
          <ConfirmationCard
            title={props.confirmationTitle}
            summary={confirmationSummary}
            confirmLabel={props.confirmLabel}
            dismissLabel={props.dismissLabel}
            confirmingLabel={props.confirmingLabel}
            applying={props.confirmationApplying}
            onConfirm={props.onConfirm}
            onDismiss={props.onDismiss}
          />
        </AssistantTurnResult>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create((theme) => ({
  userWrap: {
    alignItems: "flex-end",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  assistantWrap: {
    ...assistantTurnColumnLayout,
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  resultStretch: {
    ...assistantTurnResultStretch,
  },
  userBubble: {
    maxWidth: "80%",
    color: theme.colors.primaryForeground,
    backgroundColor: theme.colors.primary,
    overflow: "hidden",
    borderRadius: theme.radii.lg,
    borderBottomRightRadius: theme.radii.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + theme.spacing["2xs"],
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
  },
  assistantBubble: {
    color: theme.colors.foreground,
    backgroundColor: theme.colors.card,
    overflow: "hidden",
    borderRadius: theme.radii.lg,
    borderBottomLeftRadius: theme.radii.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + theme.spacing["2xs"],
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
    ...theme.shadows.sm,
  },
}));

function AssistantTurnResult(props: { readonly children: ReactNode }) {
  return <View style={styles.resultStretch}>{props.children}</View>;
}
