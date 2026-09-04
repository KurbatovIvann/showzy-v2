import type { ReactNode } from "react";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { listRowChrome } from "./list-row-chrome";

export function ListSurface(props: { readonly children: ReactNode }) {
  return <View style={styles.surface}>{props.children}</View>;
}

export function ListRow(props: {
  readonly children: ReactNode;
  readonly first?: boolean;
  readonly provisional?: boolean;
}) {
  const chrome = listRowChrome({
    first: props.first,
    provisional: props.provisional,
  });

  return (
    <View style={[styles.row, chrome.showDivider ? styles.rowDivider : null]}>
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
