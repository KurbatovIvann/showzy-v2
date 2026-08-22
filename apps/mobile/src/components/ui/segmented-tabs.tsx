import { Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

export function SegmentedTabs<K extends string>(props: {
  readonly tabs: ReadonlyArray<{ readonly key: K; readonly label: string }>;
  readonly selected: K;
  readonly onSelect: (key: K) => void;
  readonly disabled?: boolean;
}) {
  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {props.tabs.map((tab) => {
        const selected = tab.key === props.selected;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            disabled={props.disabled}
            onPress={() => {
              props.onSelect(tab.key);
            }}
            style={({ pressed }) => [
              styles.tab,
              selected ? styles.tabSelected : null,
              pressed && !selected ? styles.pressed : null,
            ]}
          >
            <Text style={selected ? styles.labelSelected : styles.label}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  tabs: {
    flexDirection: "row",
    backgroundColor: theme.colors.muted,
    borderRadius: theme.radii.full,
    padding: theme.spacing.xs,
    minHeight: theme.hitTarget.field,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radii.full,
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
    fontSize: theme.typography.base.fontSize,
  },
  labelSelected: {
    color: theme.colors.foreground,
    fontSize: theme.typography.base.fontSize,
    fontWeight: "600",
  },
}));
