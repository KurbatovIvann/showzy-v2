import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

/**
 * Technical shell only (fnd-T48). Product navigation and screens wait on
 * the UX gate and later tickets (auth is fnd-T49).
 */
export default function ShellScreen() {
  return (
    <View style={styles.screen} accessibilityLabel="Showzy foundation shell">
      <Text style={styles.title}>Showzy</Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
  },
  title: {
    color: theme.colors.foreground,
    fontSize: theme.typography["2xl"].fontSize,
    lineHeight: theme.typography["2xl"].lineHeight,
  },
}));
