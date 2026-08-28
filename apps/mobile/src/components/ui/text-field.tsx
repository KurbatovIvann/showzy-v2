import { useState, type ReactNode } from "react";
import { Text, TextInput, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { StatusPill } from "./status-pill";

export function TextField(props: {
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  readonly placeholder: string;
  readonly accessibilityLabel: string;
  readonly keyboardType?:
    "phone-pad" | "email-address" | "default" | "decimal-pad";
  readonly autoCapitalize?: "none" | "sentences" | "words" | "characters";
  readonly autoCorrect?: boolean;
  readonly autoComplete?: "email" | "tel" | "off" | "organization";
  readonly maxLength?: number;
  readonly error?: string | null;
  readonly editable?: boolean;
  readonly label?: string;
  readonly leading?: ReactNode;
  readonly prefix?: string;
  readonly suffix?: string;
  readonly changed?: boolean;
  readonly changedLabel?: string;
  readonly size?: "default" | "auth";
  readonly multiline?: boolean;
  readonly numberOfLines?: number;
}) {
  const { theme, rt } = useUnistyles();
  const [focused, setFocused] = useState(false);
  const size = props.size ?? "default";
  const auth = size === "auth";
  const multiline = props.multiline === true;
  const numberOfLines = props.numberOfLines ?? (multiline ? 3 : 1);
  const hasError = props.error != null && props.error.length > 0;
  const keyboardType = props.keyboardType ?? "email-address";
  const phone = keyboardType === "phone-pad";
  const email = keyboardType === "email-address";
  const decimal = keyboardType === "decimal-pad";
  const autoComplete =
    props.autoComplete ?? (phone ? "tel" : email ? "email" : "off");
  const textContentType = phone
    ? "telephoneNumber"
    : email
      ? "emailAddress"
      : autoComplete === "organization"
        ? "organizationName"
        : "none";
  const tabular = phone || email || decimal;
  const label =
    props.label != null && props.label.length > 0 ? props.label : null;
  const suffix =
    props.suffix != null && props.suffix.length > 0 ? props.suffix : null;
  const showChanged =
    props.changed === true &&
    props.changedLabel != null &&
    props.changedLabel.length > 0;

  return (
    <View>
      {label !== null || showChanged ? (
        <View style={styles.labelRow}>
          {label !== null ? <Text style={styles.label}>{label}</Text> : null}
          {showChanged ? (
            <StatusPill label={props.changedLabel ?? ""} tone="action" />
          ) : null}
        </View>
      ) : null}
      <View
        style={[
          styles.chrome,
          auth ? styles.chromeAuth : null,
          multiline ? styles.chromeMultiline : null,
          multiline
            ? {
                minHeight: Math.max(
                  theme.hitTarget.field,
                  theme.typography.base.lineHeight * numberOfLines +
                    theme.spacing.md * 2,
                ),
              }
            : null,
          focused && auth && !hasError ? styles.chromeFocused : null,
          hasError ? styles.chromeError : null,
        ]}
      >
        {props.leading}
        {props.prefix != null && props.prefix.length > 0 ? (
          <Text style={styles.prefix}>{props.prefix}</Text>
        ) : null}
        <TextInput
          value={props.value}
          onChangeText={props.onChangeText}
          placeholder={props.placeholder}
          accessibilityLabel={props.accessibilityLabel}
          keyboardType={keyboardType}
          keyboardAppearance={rt.themeName === "dark" ? "dark" : "light"}
          autoComplete={autoComplete}
          textContentType={textContentType}
          autoCapitalize={props.autoCapitalize ?? "none"}
          autoCorrect={props.autoCorrect ?? false}
          maxLength={props.maxLength}
          editable={props.editable !== false}
          multiline={multiline}
          numberOfLines={multiline ? numberOfLines : undefined}
          textAlignVertical={multiline ? "top" : "center"}
          placeholderTextColor={
            auth ? theme.colors.icon.muted : theme.colors.mutedForeground
          }
          onFocus={() => {
            setFocused(true);
          }}
          onBlur={() => {
            setFocused(false);
          }}
          style={[
            styles.input,
            auth ? styles.inputAuth : null,
            tabular && !multiline ? styles.tabular : null,
            multiline ? styles.inputMultiline : null,
          ]}
        />
        {suffix !== null ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
      {hasError ? (
        <Text selectable style={styles.error}>
          {props.error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  label: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
    fontWeight: "500",
  },
  chrome: {
    minHeight: theme.hitTarget.field,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.input,
    backgroundColor: theme.colors.inputFill,
    borderRadius: theme.radii.lg,
    ...theme.squircle,
    paddingHorizontal: theme.spacing.md,
  },
  chromeAuth: {
    minHeight: theme.hitTarget.auth,
    paddingHorizontal: theme.spacing.lg,
  },
  chromeMultiline: {
    alignItems: "flex-start",
    paddingVertical: theme.spacing.md,
  },
  chromeFocused: {
    borderColor: theme.colors.ring,
  },
  chromeError: {
    borderColor: theme.colors.destructive,
  },
  prefix: {
    color: theme.colors.foreground,
    fontSize: theme.typography.md.fontSize,
    lineHeight: theme.typography.md.lineHeight,
    fontWeight: "500",
  },
  suffix: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
  },
  input: {
    flex: 1,
    minWidth: 0,
    color: theme.colors.foreground,
    fontSize: theme.typography.base.fontSize,
    paddingVertical: 0,
  },
  inputAuth: {
    fontSize: theme.typography.md.fontSize,
  },
  inputMultiline: {
    paddingVertical: 0,
    textAlignVertical: "top",
  },
  tabular: {
    fontVariant: ["tabular-nums"],
  },
  error: {
    color: theme.colors.destructive,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
    fontWeight: "500",
    textAlign: "center",
  },
}));
