import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

export function EditorSection(props: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <View>
      <Text style={styles.title}>{props.title}</Text>
      <View style={styles.body}>{props.children}</View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  title: {
    paddingHorizontal: theme.spacing["2xs"],
    paddingBottom: theme.spacing.sm,
    paddingTop: theme.spacing["2xs"],
    color: theme.colors.icon.muted,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  body: {
    gap: theme.spacing.sm,
  },
}));
