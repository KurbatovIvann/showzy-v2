import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { ChevronLeftIcon } from "lucide-react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { IconButton } from "./icon-button";

/** The icon-only control must never be silent to screen readers. */
export type AppHeaderBack = {
  readonly onPress: () => void;
  readonly accessibilityLabel: string;
};

/**
 * Canvas `AppHeader`: screen title row with optional subtitle, back
 * control, and a trailing actions slot. Screens own the safe-area top
 * inset; this component only draws the row.
 */
export function AppHeader(props: {
  readonly title: string;
  readonly subtitle?: string;
  readonly back?: AppHeaderBack;
  readonly actions?: ReactNode;
}) {
  const { theme } = useUnistyles();
  return (
    <View style={styles.row}>
      {props.back !== undefined ? (
        <IconButton
          variant="secondary"
          icon={
            <ChevronLeftIcon
              size={theme.iconSize.md}
              color={theme.colors.foreground}
            />
          }
          accessibilityLabel={props.back.accessibilityLabel}
          onPress={props.back.onPress}
        />
      ) : null}
      <View style={styles.titles}>
        <Text numberOfLines={1} accessibilityRole="header" style={styles.title}>
          {props.title}
        </Text>
        {props.subtitle !== undefined && props.subtitle.length > 0 ? (
          <Text numberOfLines={1} style={styles.subtitle}>
            {props.subtitle}
          </Text>
        ) : null}
      </View>
      {props.actions != null ? (
        <View style={styles.actions}>{props.actions}</View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  titles: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: theme.colors.foreground,
    fontSize: theme.typography.xl.fontSize,
    lineHeight: theme.typography.xl.lineHeight,
    fontWeight: "600",
  },
  subtitle: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
}));
