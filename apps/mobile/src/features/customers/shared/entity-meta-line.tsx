import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

/** Canvas `MetaLine`: muted 13px row with a leading icon. */
export function EntityMetaLine(props: {
  readonly icon: ReactNode;
  readonly children: string;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.icon}>{props.icon}</View>
      <Text style={styles.text}>{props.children}</Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.sm,
  },
  icon: {
    marginTop: theme.spacing["2xs"],
  },
  text: {
    flex: 1,
    minWidth: 0,
    color: theme.colors.mutedForeground,
    // Class B: canvas 13 → typography.xs.
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
  },
}));
