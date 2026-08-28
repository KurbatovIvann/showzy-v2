import { Pressable, ScrollView, Text } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import {
  CUSTOMERS_TABS,
  type CustomersTab,
} from "./customers-home.presenter";

/**
 * Canvas customers tab strip: a horizontally scrollable pill track.
 * Not `SegmentedTabs` (that primitive is a 2-tab flex row; Ukrainian
 * four-tab labels do not fit). Class B: canvas 40/14 → hitTarget.min /
 * typography.sm.
 */
export function CustomersTabs(props: {
  readonly labels: {
    readonly clients: string;
    readonly groups: string;
    readonly counterparties: string;
    readonly invitations: string;
  };
  readonly selected: CustomersTab;
  readonly onSelect: (tab: CustomersTab) => void;
}) {
  return (
    <ScrollView
      horizontal
      accessibilityRole="tablist"
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.track}
    >
      {CUSTOMERS_TABS.map((tab) => {
        const selected = tab === props.selected;
        return (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={props.labels[tab]}
            onPress={() => {
              props.onSelect(tab);
            }}
            style={({ pressed }) => [
              styles.tab,
              selected ? styles.tabSelected : null,
              pressed && !selected ? styles.pressed : null,
            ]}
          >
            <Text style={selected ? styles.labelSelected : styles.label}>
              {props.labels[tab]}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  track: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.muted,
    borderRadius: theme.radii.full,
    padding: theme.spacing.xs,
    minHeight: theme.hitTarget.field,
  },
  tab: {
    minHeight: theme.hitTarget.min,
    justifyContent: "center",
    borderRadius: theme.radii.full,
    paddingHorizontal: theme.spacing.lg,
  },
  tabSelected: {
    backgroundColor: theme.colors.card,
    ...theme.shadows.sm,
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
    fontWeight: "500",
  },
  labelSelected: {
    color: theme.colors.foreground,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
    fontWeight: "600",
  },
}));
