import { Text, TextInput, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

function otpHasError(error: boolean | string | undefined): boolean {
  return error === true || (typeof error === "string" && error.length > 0);
}

function otpErrorText(error: boolean | string | undefined): string | null {
  return typeof error === "string" && error.length > 0 ? error : null;
}

/** Generic one-time-code boxes. The code length arrives as a prop so this
 * component stays independent of any feature policy. */
export function OtpInput(props: {
  readonly value: string;
  readonly length: number;
  readonly onChange: (value: string) => void;
  readonly disabled?: boolean;
  readonly error?: boolean | string;
  readonly accessibilityLabel: string;
}) {
  const hasError = otpHasError(props.error);
  const errorText = otpErrorText(props.error);
  const cells = Array.from({ length: props.length }, (_, index) => {
    const filled = props.value[index] !== undefined;
    const active = index === props.value.length;
    return (
      <View
        key={index}
        style={[
          styles.cell,
          hasError
            ? styles.cellError
            : active
              ? styles.cellActive
              : filled
                ? styles.cellFilled
                : styles.cellIdle,
        ]}
      >
        <Text style={styles.digit}>{props.value[index] ?? ""}</Text>
      </View>
    );
  });

  return (
    <View>
      <View style={styles.row}>{cells}</View>
      <TextInput
        value={props.value}
        onChangeText={(text) => {
          props.onChange(text.replaceAll(/\D/g, "").slice(0, props.length));
        }}
        keyboardType="number-pad"
        maxLength={props.length}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        editable={props.disabled !== true}
        accessibilityLabel={props.accessibilityLabel}
        style={styles.hiddenInput}
      />
      {errorText !== null ? (
        <Text style={styles.error}>{errorText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: "row",
    justifyContent: "center",
    gap: theme.spacing.sm,
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radii.lg,
    borderWidth: 2,
  },
  cellIdle: {
    borderColor: theme.colors.input,
  },
  cellFilled: {
    borderColor: theme.colors.foreground,
  },
  cellActive: {
    borderColor: theme.colors.ring,
  },
  cellError: {
    borderColor: theme.colors.destructive,
  },
  digit: {
    color: theme.colors.foreground,
    fontSize: theme.typography["2xl"].fontSize,
    lineHeight: theme.typography["2xl"].lineHeight,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  hiddenInput: {
    position: "absolute",
    opacity: 0,
    width: "100%",
    height: "100%",
  },
  error: {
    color: theme.colors.destructive,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
    marginTop: theme.spacing.sm,
  },
}));
