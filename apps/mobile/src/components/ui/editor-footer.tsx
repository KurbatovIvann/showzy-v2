import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { Button } from "./button";
import { editorFooterChrome } from "./editor-footer-chrome";

export function EditorFooter(props: {
  readonly cancelLabel: string;
  readonly confirmLabel: string;
  readonly confirming?: boolean;
  readonly confirmDisabled?: boolean;
  readonly cancelDisabled?: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
  readonly empty?: boolean;
  readonly emptyLabel?: string;
  readonly metaLabel?: string;
  readonly metaValue?: string;
  readonly metaValueMuted?: boolean;
  readonly hint?: string;
  readonly leading?: ReactNode;
  readonly cancelIcon?: ReactNode;
  readonly confirmIcon?: ReactNode;
}) {
  const confirming = props.confirming === true;
  const chrome = editorFooterChrome({
    empty: props.empty,
    emptyLabel: props.emptyLabel,
    metaLabel: props.metaLabel,
    hint: props.hint,
    leading: props.leading !== undefined,
  });
  const metaValue = props.metaValue ?? "";

  return (
    <View style={styles.dock}>
      <View style={styles.card}>
        {chrome.showEmpty ? (
          <Text style={styles.empty}>{props.emptyLabel}</Text>
        ) : null}
        {chrome.showMeta ? (
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>{props.metaLabel}</Text>
            {metaValue.length > 0 ? (
              <Text
                style={
                  props.metaValueMuted === true
                    ? styles.metaValueMuted
                    : styles.metaValue
                }
              >
                {metaValue}
              </Text>
            ) : null}
          </View>
        ) : null}
        {chrome.showHint ? <Text style={styles.hint}>{props.hint}</Text> : null}
        {chrome.showLeading ? props.leading : null}
        <View style={styles.actions}>
          <View style={styles.button}>
            <Button
              variant="secondary"
              fullWidth
              label={props.cancelLabel}
              disabled={props.cancelDisabled === true}
              onPress={props.onCancel}
              {...(props.cancelIcon !== undefined
                ? { icon: props.cancelIcon }
                : {})}
            />
          </View>
          <View style={styles.button}>
            <Button
              fullWidth
              label={props.confirmLabel}
              loading={confirming}
              disabled={props.confirmDisabled === true}
              onPress={props.onConfirm}
              {...(props.confirmIcon !== undefined
                ? { icon: props.confirmIcon }
                : {})}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  dock: {
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.card,
    ...theme.squircle,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
    ...theme.shadows.nav,
  },
  empty: {
    color: theme.colors.icon.muted,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
    fontWeight: "500",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: theme.spacing.md,
  },
  metaLabel: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
  },
  metaValue: {
    color: theme.colors.foreground,
    fontSize: theme.typography["2xl"].fontSize,
    lineHeight: theme.typography["2xl"].lineHeight,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  metaValueMuted: {
    color: theme.colors.icon.muted,
    fontSize: theme.typography["2xl"].fontSize,
    lineHeight: theme.typography["2xl"].lineHeight,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  hint: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
  },
  actions: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  button: {
    flex: 1,
  },
}));
