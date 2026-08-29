import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { Button, Sheet } from "../../../components/ui";
import type { DocumentsCopy } from "../../../i18n/documents";

/**
 * Handover sheet after `documents.share`. Shows the public `/d/{token}`
 * URL plus copy / native share. A scannable QR bitmap is omitted: no QR
 * encoder is in the native kit and new npm dependencies are forbidden.
 */
export function DocumentHandoverSheet(props: {
  readonly visible: boolean;
  readonly title: string;
  readonly url: string | null;
  readonly copy: DocumentsCopy;
  readonly copied: boolean;
  readonly copyFailed: boolean;
  readonly onClose: () => void;
  readonly onHidden: () => void;
  readonly onCopy: () => void;
  readonly onShare: () => void;
}) {
  return (
    <Sheet
      visible={props.visible}
      title={props.title}
      closeAccessibilityLabel={props.copy.handover.close}
      onClose={props.onClose}
      onHidden={props.onHidden}
    >
      <Text style={styles.hint}>{props.copy.handover.hint}</Text>
      {props.url !== null ? (
        <View style={styles.urlBox}>
          <Text selectable style={styles.url}>
            {props.url}
          </Text>
        </View>
      ) : null}
      {props.copyFailed ? (
        <Text style={styles.failed}>{props.copy.handover.copyFailed}</Text>
      ) : null}
      <View style={styles.actions}>
        <Button
          variant="secondary"
          fullWidth
          label={
            props.copied ? props.copy.handover.copied : props.copy.handover.copy
          }
          onPress={props.onCopy}
        />
        <Button
          fullWidth
          label={props.copy.handover.share}
          onPress={props.onShare}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create((theme) => ({
  hint: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
    marginBottom: theme.spacing.md,
  },
  urlBox: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
    ...theme.squircle,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  url: {
    color: theme.colors.foreground,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
  },
  failed: {
    color: theme.colors.destructive,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
    marginBottom: theme.spacing.md,
  },
  actions: {
    gap: theme.spacing.sm,
  },
}));
