import type { ReactNode } from "react";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

/** Auth card chrome (28 radius + auth shadow). Shared `Card` stays 22. */
export function AuthPanel(props: { readonly children: ReactNode }) {
  return <View style={styles.panel}>{props.children}</View>;
}

const styles = StyleSheet.create((theme) => ({
  panel: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radii.authPanel,
    padding: theme.spacing.xl,
    gap: theme.spacing.xl,
    ...theme.shadows.auth,
  },
}));
