import { useLayoutEffect, useRef } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

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
  const { rt } = useUnistyles();
  const inputRef = useRef<TextInput>(null);
  const disabled = props.disabled === true;
  const hasError = otpHasError(props.error);
  const errorText = otpErrorText(props.error);

  function focusInput(): void {
    if (disabled) {
      return;
    }
    inputRef.current?.focus();
  }

  // Focus before paint so the IME can transfer from the previous field
  // instead of dismissing and reopening (black window + delay).
  useLayoutEffect(() => {
    if (disabled) {
      return;
    }
    inputRef.current?.focus();
  }, [disabled]);

  const cells = Array.from({ length: props.length }, (_, index) => {
    const filled = props.value[index] !== undefined;
    const active = index === props.value.length;
    return (
      <View
        key={index}
        pointerEvents="none"
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
      <View style={styles.field}>
        <Pressable
          accessible={false}
          disabled={disabled}
          onPress={focusInput}
          style={styles.row}
        >
          {cells}
        </Pressable>
        <TextInput
          ref={inputRef}
          value={props.value}
          onChangeText={(text) => {
            props.onChange(text.replaceAll(/\D/g, "").slice(0, props.length));
          }}
          keyboardType="number-pad"
          inputMode="numeric"
          keyboardAppearance={rt.themeName === "dark" ? "dark" : "light"}
          maxLength={props.length}
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          importantForAutofill="yes"
          caretHidden
          showSoftInputOnFocus
          editable={!disabled}
          accessibilityLabel={props.accessibilityLabel}
          style={styles.hiddenInput}
        />
      </View>
      {errorText !== null ? (
        <Text selectable style={styles.error}>
          {errorText}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  field: {
    position: "relative",
  },
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
    ...theme.squircle,
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
  // Opacity 0 is ignored by Android and KeyboardProvider (no IME, no taps).
  // Overlay the field so a tap hits this input; digits stay in the cells.
  hiddenInput: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.02,
    color: "transparent",
  },
  error: {
    color: theme.colors.destructive,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
    marginTop: theme.spacing.sm,
  },
}));
