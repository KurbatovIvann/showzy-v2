import { Pressable, Text, View } from "react-native";
import { LockIcon, UploadCloudIcon } from "lucide-react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { Banner, Button, Sheet, TextField } from "../../../components/ui";
import type { DocumentsCopy } from "../../../i18n/documents";
import {
  signingSessionCanSubmit,
  signingSessionIsBusy,
  type SigningSessionContext,
} from "./signing-session";

export function DocumentSigningSheet(props: {
  readonly session: SigningSessionContext;
  readonly copy: DocumentsCopy;
  readonly onClose: () => void;
  readonly onHidden: () => void;
  readonly onPickKey: () => void;
  readonly onChangePassword: (value: string) => void;
  readonly onSubmit: () => void;
}) {
  const { theme } = useUnistyles();
  const session = props.session;
  const copy = props.copy.signing;
  const busy = signingSessionIsBusy(session);
  const canSubmit = signingSessionCanSubmit(session);
  const banner = session.banner === null ? null : copy.banners[session.banner];
  const pickLabel = session.fileName ?? copy.pickKey;

  return (
    <Sheet
      visible={session.visible}
      title={copy.title}
      closeAccessibilityLabel={copy.close}
      onClose={props.onClose}
      onHidden={props.onHidden}
      footer={
        <Button
          fullWidth
          label={busy ? copy.submitBusy : copy.submit}
          loading={busy}
          disabled={!canSubmit}
          onPress={props.onSubmit}
        />
      }
    >
      {session.documentNumber !== null ? (
        <Text style={styles.number}>№{session.documentNumber}</Text>
      ) : null}
      <Text style={styles.hint}>{copy.hint}</Text>
      <View style={styles.lock}>
        <LockIcon size={theme.iconSize.sm} color={theme.colors.warning} />
        <Text style={styles.lockText}>{copy.lock}</Text>
      </View>
      {banner !== null ? (
        <View style={styles.banner}>
          <Banner message={banner} />
        </View>
      ) : null}
      <Text style={styles.label}>{copy.pickKey}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.pickKeyA11y}
        disabled={busy}
        onPress={props.onPickKey}
        style={({ pressed }) => [
          styles.picker,
          pressed && !busy ? styles.pressed : null,
          busy ? styles.disabled : null,
        ]}
      >
        <UploadCloudIcon
          size={theme.iconSize.md}
          color={theme.colors.mutedForeground}
        />
        <Text style={styles.pickerLabel}>{pickLabel}</Text>
      </Pressable>
      <TextField
        label={copy.passwordLabel}
        value={session.password}
        onChangeText={props.onChangePassword}
        placeholder={copy.passwordPlaceholder}
        accessibilityLabel={copy.passwordA11y}
        keyboardType="default"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="password"
        secureTextEntry
        editable={!busy}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create((theme) => ({
  number: {
    color: theme.colors.foreground,
    fontSize: theme.typography.base.fontSize,
    lineHeight: theme.typography.base.lineHeight,
    fontWeight: "600",
    marginBottom: theme.spacing.sm,
  },
  hint: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
    marginBottom: theme.spacing.md,
  },
  lock: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.warningSoft,
    borderRadius: theme.radii.xl,
    ...theme.squircle,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  lockText: {
    flex: 1,
    color: theme.colors.warning,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
  },
  banner: {
    marginBottom: theme.spacing.md,
  },
  label: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
    fontWeight: "500",
    marginBottom: theme.spacing.sm,
  },
  picker: {
    minHeight: theme.hitTarget.auth,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    borderRadius: theme.radii.xl,
    ...theme.squircle,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  pickerLabel: {
    color: theme.colors.foreground,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
    fontWeight: "500",
    textAlign: "center",
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
}));
