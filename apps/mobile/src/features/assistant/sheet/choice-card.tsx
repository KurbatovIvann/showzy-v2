import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { Button, Card } from "../../../components/ui";
import {
  claimedOptionLabel,
  claimedRetryOptionId,
  type StaffAssistantChoiceCardEnvelope,
} from "../shared/choice";

export function ChoiceCard(props: {
  readonly title: string;
  readonly truncatedLabel: string | null;
  readonly expiredLabel: string;
  readonly claimedLabel: string;
  readonly retryLabel: string;
  readonly selectingLabel: string;
  readonly applying: boolean;
  readonly choice: StaffAssistantChoiceCardEnvelope;
  readonly onSelect: (optionId: string) => void;
}) {
  const pickerTappable =
    props.choice.status === "needs_choice" && !props.applying;
  const retryOptionId = claimedRetryOptionId(props.choice);
  const selectedLabel = claimedOptionLabel(props.choice);
  const claimed = props.choice.status === "claimed";
  const expired = props.choice.status === "expired";

  return (
    <Card>
      <View style={styles.body}>
        <Text style={styles.title}>{props.title}</Text>
        {props.truncatedLabel !== null && !claimed && !expired ? (
          <Text style={styles.note}>{props.truncatedLabel}</Text>
        ) : null}
        {expired ? <Text style={styles.note}>{props.expiredLabel}</Text> : null}
        {claimed ? <Text style={styles.note}>{props.claimedLabel}</Text> : null}
        {claimed && selectedLabel !== undefined ? (
          <Text style={styles.selected}>{selectedLabel}</Text>
        ) : null}
        {props.applying ? (
          <Text style={styles.applying}>{props.selectingLabel}</Text>
        ) : pickerTappable ? (
          <View style={styles.options}>
            {props.choice.options.map((option) => (
              <Button
                key={option.id}
                variant="secondary"
                fullWidth
                label={option.label}
                onPress={() => {
                  props.onSelect(option.id);
                }}
              />
            ))}
          </View>
        ) : retryOptionId !== undefined && claimed ? (
          <Button
            fullWidth
            label={props.retryLabel}
            onPress={() => {
              props.onSelect(retryOptionId);
            }}
          />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create((theme) => ({
  body: {
    gap: theme.spacing.md,
  },
  title: {
    color: theme.colors.foreground,
    fontSize: theme.typography.base.fontSize,
    lineHeight: theme.typography.base.lineHeight,
    fontWeight: "600",
  },
  note: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
  },
  selected: {
    color: theme.colors.foreground,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
    fontWeight: "600",
  },
  applying: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
    textAlign: "center",
    paddingVertical: theme.spacing.sm,
  },
  options: {
    gap: theme.spacing.sm,
  },
}));
