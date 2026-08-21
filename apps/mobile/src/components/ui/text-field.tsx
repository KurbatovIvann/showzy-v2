import { useState, type ReactNode } from "react";
import { Text, TextInput, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

export function TextField(props: {
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  readonly placeholder: string;
  readonly accessibilityLabel: string;
  readonly keyboardType?: "phone-pad" | "email-address";
  readonly error?: string | null;
  readonly editable?: boolean;
  readonly label?: string;
  readonly leading?: ReactNode;
  readonly prefix?: string;
  readonly size?: "default" | "auth";
}) {
  const { theme } = useUnistyles();
  const [focused, setFocused] = useState(false);
  const size = props.size ?? "default";
  const auth = size === "auth";
  const hasError = props.error != null && props.error.length > 0;

  return (
    <View>
      {props.label != null && props.label.length > 0 ? (
        <Text style={styles.label}>{props.label}</Text>
      ) : null}
      <View
        style={[
          styles.chrome,
          auth ? styles.chromeAuth : null,
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
          keyboardType={props.keyboardType ?? "email-address"}
          autoCapitalize="none"
          autoCorrect={false}
          editable={props.editable !== false}
          placeholderTextColor={
            auth ? theme.colors.icon.muted : theme.colors.mutedForeground
          }
          onFocus={() => {
            setFocused(true);
          }}
          onBlur={() => {
            setFocused(false);
          }}
          style={[styles.input, auth ? styles.inputAuth : null]}
        />
      </View>
      {hasError ? <Text style={styles.error}>{props.error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  label: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
    fontWeight: "500",
    marginBottom: theme.spacing.sm,
  },
  chrome: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.input,
    backgroundColor: theme.colors.inputFill,
    borderRadius: theme.radii.lg,
    paddingHorizontal: theme.spacing.md,
  },
  chromeAuth: {
    minHeight: theme.hitTarget.auth,
    paddingHorizontal: theme.spacing.lg,
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
  input: {
    flex: 1,
    minWidth: 0,
    color: theme.colors.foreground,
    fontSize: theme.typography.base.fontSize,
    paddingVertical: 0,
  },
  inputAuth: {
    fontSize: theme.typography.md.fontSize,
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
