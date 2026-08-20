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

const styles = StyleSheet.create((theme) => ({
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
}));
