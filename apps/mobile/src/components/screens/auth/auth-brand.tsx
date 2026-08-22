import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

export function AuthBrand(props: { readonly tagline: string }) {
  return (
    <View style={styles.brand} accessibilityRole="header">
      <Text style={styles.wordmark}>ШОЗІ</Text>
      <Text style={styles.tagline}>{props.tagline}</Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  brand: {
    paddingHorizontal: theme.spacing.sm,
    paddingTop: theme.spacing["3xl"] + theme.spacing.sm,
    paddingBottom: theme.spacing["3xl"],
    alignItems: "center",
  },
  wordmark: {
    color: theme.colors.foreground,
    fontSize: theme.typography.display.fontSize,
    lineHeight: theme.typography.display.lineHeight,
    fontWeight: "700",
    textAlign: "center",
  },
  tagline: {
    color: theme.colors.mutedForeground,
    marginTop: theme.spacing.md,
    fontSize: theme.typography.md.fontSize,
    lineHeight: theme.typography.md.lineHeight,
    textAlign: "center",
  },
}));
