import type { ReactNode } from "react";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

export function Card(props: {
  readonly children: ReactNode;
  readonly provisional?: boolean;
}) {
  return (
    <View
      style={[
        styles.card,
        props.provisional === true ? styles.provisional : null,
      ]}
    >
      {props.children}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radii.card,
    ...theme.squircle,
    padding: theme.spacing.lg,
    gap: theme.spacing.xl,
    ...theme.shadows.sm,
  },
  provisional: {
    backgroundColor: theme.colors.provisionalFill,
    borderColor: theme.colors.provisionalBorder,
    borderStyle: "dashed",
  },
}));
