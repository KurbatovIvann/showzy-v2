import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { Button, Card } from "../../../components/ui";
import type { StaffAssistantChoiceCardEnvelope } from "../shared/choice";

export function ChoiceCard(props: {
  readonly title: string;
  readonly truncatedLabel: string | null;
  readonly expiredLabel: string;
  readonly selectingLabel: string;
  readonly applying: boolean;
  readonly choice: StaffAssistantChoiceCardEnvelope;
  readonly onSelect: (optionId: string) => void;
}) {
  const tappable = props.choice.status === "needs_choice" && !props.applying;
  const expired = props.choice.status === "expired";

  return (
    <Card>
      <View style={styles.body}>
        <Text style={styles.title}>{props.title}</Text>
        {props.truncatedLabel !== null ? (
          <Text style={styles.note}>{props.truncatedLabel}</Text>
        ) : null}
        {expired ? <Text style={styles.note}>{props.expiredLabel}</Text> : null}
        {props.applying ? (
          <Text style={styles.applying}>{props.selectingLabel}</Text>
        ) : tappable ? (
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
