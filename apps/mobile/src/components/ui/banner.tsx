import { Text } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { fieldErrorTextStyle } from "./field-error-text";

export function Banner({ message }: { readonly message: string }) {
  return (
    <Text selectable accessibilityRole="alert" style={styles.error}>
      {message}
    </Text>
  );
}

const styles = StyleSheet.create((theme) => ({
  error: fieldErrorTextStyle(theme),
}));
