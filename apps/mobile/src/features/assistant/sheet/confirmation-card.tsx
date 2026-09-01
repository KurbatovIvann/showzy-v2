import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { Button, Card } from "../../../components/ui";

export function ConfirmationCard(props: {
  readonly title: string;
  readonly summary: string;
  readonly confirmLabel: string;
  readonly dismissLabel: string;
  readonly confirmingLabel: string;
  readonly applying: boolean;
  readonly onConfirm: () => void;
  readonly onDismiss: () => void;
}) {
  return (
    <Card>
      <View style={styles.body}>
        <Text style={styles.title}>{props.title}</Text>
        <Text style={styles.summary}>{props.summary}</Text>
        {props.applying ? (
          <Text style={styles.applying}>{props.confirmingLabel}</Text>
        ) : (
          <View style={styles.actions}>
            <View style={styles.action}>
              <Button
                variant="secondary"
                fullWidth
                label={props.dismissLabel}
                onPress={props.onDismiss}
              />
            </View>
            <View style={styles.action}>
              <Button
                fullWidth
                label={props.confirmLabel}
                onPress={props.onConfirm}
              />
            </View>
          </View>
        )}
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
  summary: {
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
  actions: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  action: {
    flex: 1,
  },
}));
