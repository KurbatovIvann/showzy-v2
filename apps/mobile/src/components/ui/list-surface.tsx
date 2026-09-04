import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { listRowChrome, type ListRowGroupEdge } from "./list-row-chrome";

export function ListSurface(props: {
  readonly children: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.surface, props.style]}>{props.children}</View>;
}

export function ListRow(props: {
  readonly children: ReactNode;
  readonly first?: boolean;
  readonly provisional?: boolean;
  readonly groupEdge?: ListRowGroupEdge;
}) {
  const chrome = listRowChrome({
    first: props.first,
    provisional: props.provisional,
    groupEdge: props.groupEdge,
  });
  const groupStyle =
    chrome.groupEdge === "start"
      ? styles.groupStart
      : chrome.groupEdge === "middle"
        ? styles.groupMiddle
        : chrome.groupEdge === "end"
          ? styles.groupEnd
          : chrome.groupEdge === "only"
            ? styles.groupOnly
            : null;

  return (
    <View
      style={[
        styles.row,
        groupStyle,
        chrome.showDivider ? styles.rowDivider : null,
      ]}
    >
      {chrome.provisional ? (
        <View style={styles.provisional}>{props.children}</View>
      ) : (
        props.children
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  surface: {
    overflow: "hidden",
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radii.card,
    ...theme.squircle,
    ...theme.shadows.sm,
  },
  row: {
    backgroundColor: theme.colors.card,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  groupStart: {
    marginHorizontal: theme.spacing.lg,
    overflow: "hidden",
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderTopLeftRadius: theme.radii.card,
    borderTopRightRadius: theme.radii.card,
    ...theme.squircle,
  },
  groupMiddle: {
    marginHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
  groupEnd: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    overflow: "hidden",
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomLeftRadius: theme.radii.card,
    borderBottomRightRadius: theme.radii.card,
    ...theme.squircle,
  },
  groupOnly: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    overflow: "hidden",
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radii.card,
    ...theme.squircle,
    ...theme.shadows.sm,
  },
  provisional: {
    margin: theme.spacing.sm,
    overflow: "hidden",
    backgroundColor: theme.colors.provisionalFill,
    borderColor: theme.colors.provisionalBorder,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: theme.radii.lg,
    ...theme.squircle,
  },
}));
