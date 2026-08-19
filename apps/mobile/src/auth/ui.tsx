import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { authPolicy } from "./policy";

export function AuthCard({ children }: { readonly children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function AuthButton(props: {
  readonly label: string;
  readonly onPress: () => void;
  readonly loading?: boolean;
  readonly disabled?: boolean;
  readonly variant?: "primary" | "ghost";
}) {
  const variant = props.variant ?? "primary";
  const disabled = props.disabled === true || props.loading === true;
  const { theme } = useUnistyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      disabled={disabled}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.button,
        variant === "ghost" ? styles.buttonGhost : styles.buttonPrimary,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}
    >
      {props.loading === true ? (
        <ActivityIndicator
          color={
            variant === "ghost"
              ? theme.colors.activityIndicator.onBackground
              : theme.colors.activityIndicator.onPrimary
          }
        />
      ) : (
        <Text
          style={
            variant === "ghost" ? styles.buttonGhostLabel : styles.buttonLabel
          }
        >
          {props.label}
        </Text>
      )}
    </Pressable>
  );
}

export function AuthField(props: {
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  readonly placeholder: string;
  readonly accessibilityLabel: string;
  readonly keyboardType?: "phone-pad" | "email-address";
  readonly error?: string | null;
  readonly editable?: boolean;
}) {
  const { theme } = useUnistyles();
  return (
    <View>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        accessibilityLabel={props.accessibilityLabel}
        keyboardType={props.keyboardType ?? "email-address"}
        autoCapitalize="none"
        autoCorrect={false}
        editable={props.editable !== false}
        placeholderTextColor={theme.colors.mutedForeground}
        style={[styles.input, props.error ? styles.inputError : null]}
      />
      {props.error ? <Text style={styles.error}>{props.error}</Text> : null}
    </View>
  );
}

export function AuthTabs(props: {
  readonly phoneLabel: string;
  readonly emailLabel: string;
  readonly selected: "phone" | "email";
  readonly onChange: (channel: "phone" | "email") => void;
  readonly disabled?: boolean;
}) {
  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: props.selected === "phone" }}
        disabled={props.disabled}
        onPress={() => {
          props.onChange("phone");
        }}
        style={[
          styles.tab,
          props.selected === "phone" ? styles.tabSelected : null,
        ]}
      >
        <Text
          style={
            props.selected === "phone"
              ? styles.tabLabelSelected
              : styles.tabLabel
          }
        >
          {props.phoneLabel}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: props.selected === "email" }}
        disabled={props.disabled}
        onPress={() => {
          props.onChange("email");
        }}
        style={[
          styles.tab,
          props.selected === "email" ? styles.tabSelected : null,
        ]}
      >
        <Text
          style={
            props.selected === "email"
              ? styles.tabLabelSelected
              : styles.tabLabel
          }
        >
          {props.emailLabel}
        </Text>
      </Pressable>
    </View>
  );
}

export function OtpBoxes(props: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly disabled?: boolean;
  readonly error?: boolean;
  readonly accessibilityLabel: string;
}) {
  const cells = Array.from({ length: authPolicy.otpLength }, (_, index) => {
    const filled = props.value[index] !== undefined;
    const active = index === props.value.length;
    return (
      <View
        key={index}
        style={[
          styles.otpCell,
          props.error === true
            ? styles.otpError
            : active
              ? styles.otpActive
              : filled
                ? styles.otpFilled
                : styles.otpIdle,
        ]}
      >
        <Text style={styles.otpDigit}>{props.value[index] ?? ""}</Text>
      </View>
    );
  });

  return (
    <View>
      <View style={styles.otpRow}>{cells}</View>
      <TextInput
        value={props.value}
        onChangeText={(text) => {
          props.onChange(
            text.replaceAll(/\D/g, "").slice(0, authPolicy.otpLength),
          );
        }}
        keyboardType="number-pad"
        maxLength={authPolicy.otpLength}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        editable={props.disabled !== true}
        accessibilityLabel={props.accessibilityLabel}
        style={styles.hiddenInput}
      />
    </View>
  );
}

export function Banner({ message }: { readonly message: string }) {
  return (
    <Text accessibilityRole="alert" style={styles.error}>
      {message}
    </Text>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.md,
    padding: theme.spacing.lg,
    gap: theme.spacing.xl,
  },
  button: {
    minHeight: 48,
    borderRadius: theme.radii.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.lg,
  },
  buttonPrimary: {
    backgroundColor: theme.colors.primary,
  },
  buttonGhost: {
    backgroundColor: "transparent",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonLabel: {
    color: theme.colors.primaryForeground,
    fontSize: theme.typography.md.fontSize,
    lineHeight: theme.typography.md.lineHeight,
    fontWeight: "600",
  },
  buttonGhostLabel: {
    color: theme.colors.primary,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
    fontWeight: "500",
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: theme.colors.input,
    backgroundColor: theme.colors.inputFill,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing.md,
    color: theme.colors.foreground,
    fontSize: theme.typography.base.fontSize,
  },
  inputError: {
    borderColor: theme.colors.destructive,
  },
  error: {
    color: theme.colors.destructive,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
    fontWeight: "500",
    textAlign: "center",
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: theme.colors.muted,
    borderRadius: theme.radii.md,
    padding: theme.spacing.xs,
    minHeight: 48,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radii.sm,
  },
  tabSelected: {
    backgroundColor: theme.colors.card,
  },
  tabLabel: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.base.fontSize,
  },
  tabLabelSelected: {
    color: theme.colors.foreground,
    fontSize: theme.typography.base.fontSize,
    fontWeight: "600",
  },
  otpRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: theme.spacing.md,
  },
  otpCell: {
    height: 56,
    width: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radii.md,
    borderWidth: 2,
  },
  otpIdle: {
    borderColor: theme.colors.input,
  },
  otpFilled: {
    borderColor: theme.colors.border,
  },
  otpActive: {
    borderColor: theme.colors.ring,
  },
  otpError: {
    borderColor: theme.colors.destructive,
  },
  otpDigit: {
    color: theme.colors.foreground,
    fontSize: theme.typography["2xl"].fontSize,
    lineHeight: theme.typography["2xl"].lineHeight,
    fontWeight: "600",
  },
  hiddenInput: {
    position: "absolute",
    opacity: 0,
    width: "100%",
    height: 56,
  },
}));
