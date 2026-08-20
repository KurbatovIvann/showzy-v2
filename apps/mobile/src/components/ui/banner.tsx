import { Text } from "react-native";
import { StyleSheet } from "react-native-unistyles";

export function Banner({ message }: { readonly message: string }) {
  return (
    <Text accessibilityRole="alert" style={styles.error}>
      {message}
    </Text>
  );
}

const styles = StyleSheet.create((theme) => ({
  error: {
    color: theme.colors.destructive,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
    fontWeight: "500",
    textAlign: "center",
  },
}));
