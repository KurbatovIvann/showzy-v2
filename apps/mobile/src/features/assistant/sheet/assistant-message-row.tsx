import { memo, type ReactNode } from "react";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import {
  assistantTurnColumnLayout,
  assistantTurnResultStretch,
} from "../shared/assistant-turn-layout";
import type { AssistantTimelineStep } from "../shared/chat-rows";
import { assistantSurfaceKey, type AssistantSurface } from "../surfaces";
import { AssistantSurfaceCard } from "./assistant-surface-card";
import { AssistantTimeline } from "./assistant-timeline";
import { ConfirmationCard } from "./confirmation-card";

export const AssistantMessageRow = memo(function AssistantMessageRow(props: {
  readonly role: "user" | "assistant";
  readonly text: string;
  readonly timeline: readonly AssistantTimelineStep[];
  readonly timelineLabel: string;
  readonly surfaces: readonly AssistantSurface[];
  readonly onOpenHref: (href: string) => void;
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
      {props.surfaces.map((surface) => (
        <AssistantTurnResult key={assistantSurfaceKey(surface)}>
          <AssistantSurfaceCard
            surface={surface}
            onOpenHref={props.onOpenHref}
          />
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
