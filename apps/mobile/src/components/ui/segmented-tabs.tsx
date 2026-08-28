/**
 * Canvas `AuthModeSwitch` / customers tab strip. `layout="equal"` is the
 * two-up auth row. `layout="scroll"` is the overflowing CRM strip: the
 * muted pill track is content-sized and scrolls as one unit (no edge
 * masks, no iOS automatic content insets).
 */
import { useEffect, useRef } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { scrollXToRevealTab } from "./segmented-tabs.layout";

export type SegmentedTabsLayout = "equal" | "scroll";

export function SegmentedTabs<K extends string>(props: {
  readonly tabs: ReadonlyArray<{ readonly key: K; readonly label: string }>;
  readonly selected: K;
  readonly onSelect: (key: K) => void;
  readonly disabled?: boolean;
  readonly layout?: SegmentedTabsLayout;
}) {
  const layout = props.layout ?? "equal";
  if (layout === "scroll") {
    return (
      <ScrollableSegmentedTabs
        tabs={props.tabs}
        selected={props.selected}
        onSelect={props.onSelect}
        disabled={props.disabled === true}
      />
    );
  }
  return (
    <View style={styles.equalTrack} accessibilityRole="tablist">
      {props.tabs.map((tab) => (
        <SegmentedTab
          key={tab.key}
          label={tab.label}
          selected={tab.key === props.selected}
          disabled={props.disabled === true}
          grow
          onPress={() => {
            props.onSelect(tab.key);
          }}
        />
      ))}
    </View>
  );
}

function ScrollableSegmentedTabs<K extends string>(props: {
  readonly tabs: ReadonlyArray<{ readonly key: K; readonly label: string }>;
  readonly selected: K;
  readonly onSelect: (key: K) => void;
  readonly disabled?: boolean;
}) {
  const { theme } = useUnistyles();
  const gutter = theme.spacing.sm;
  const scrollRef = useRef<ScrollView>(null);
  const viewportWidth = useRef(0);
  const contentWidth = useRef(0);
  const tabMetrics = useRef<Partial<Record<K, { x: number; width: number }>>>(
    {},
  );

  function reveal(key: K): void {
    const tab = tabMetrics.current[key];
    if (tab === undefined) {
      return;
    }
    scrollRef.current?.scrollTo({
      x: scrollXToRevealTab({
        tabX: tab.x,
        tabWidth: tab.width,
        viewportWidth: viewportWidth.current,
        contentWidth: contentWidth.current,
        gutter,
      }),
      animated: true,
    });
  }

  useEffect(() => {
    const tab = tabMetrics.current[props.selected];
    if (tab === undefined) {
      return;
    }
    scrollRef.current?.scrollTo({
      x: scrollXToRevealTab({
        tabX: tab.x,
        tabWidth: tab.width,
        viewportWidth: viewportWidth.current,
        contentWidth: contentWidth.current,
        gutter,
      }),
      animated: true,
    });
  }, [gutter, props.selected]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      accessibilityRole="tablist"
      showsHorizontalScrollIndicator={false}
      bounces={false}
      alwaysBounceHorizontal={false}
      overScrollMode="never"
      automaticallyAdjustContentInsets={false}
      contentInsetAdjustmentBehavior="never"
      contentInset={{ left: 0, right: 0 }}
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      onLayout={(event: LayoutChangeEvent) => {
        viewportWidth.current = event.nativeEvent.layout.width;
      }}
    >
      <View
        style={styles.scrollTrack}
        onLayout={(event: LayoutChangeEvent) => {
          contentWidth.current = event.nativeEvent.layout.width;
        }}
      >
        {props.tabs.map((tab) => (
          <SegmentedTab
            key={tab.key}
            label={tab.label}
            selected={tab.key === props.selected}
            disabled={props.disabled === true}
            compact
            onLayout={(event) => {
              tabMetrics.current[tab.key] = {
                x: event.nativeEvent.layout.x,
                width: event.nativeEvent.layout.width,
              };
              if (tab.key === props.selected) {
                reveal(tab.key);
              }
            }}
            onPress={() => {
              props.onSelect(tab.key);
              reveal(tab.key);
            }}
          />
        ))}
      </View>
    </ScrollView>
  );
}

function SegmentedTab(props: {
  readonly label: string;
  readonly selected: boolean;
  readonly disabled?: boolean;
  readonly grow?: boolean;
  readonly compact?: boolean;
  readonly onPress: () => void;
  readonly onLayout?: (event: LayoutChangeEvent) => void;
}) {
  const compact = props.compact === true;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: props.selected }}
      accessibilityLabel={props.label}
      disabled={props.disabled === true}
      onLayout={props.onLayout}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.tab,
        props.grow === true ? styles.tabGrow : null,
        compact ? styles.tabCompact : null,
        props.selected ? styles.tabSelected : null,
        pressed && !props.selected ? styles.pressed : null,
      ]}
    >
      <Text
        numberOfLines={compact ? 1 : undefined}
        style={
          compact
            ? props.selected
              ? styles.compactLabelSelected
              : styles.compactLabel
            : props.selected
              ? styles.labelSelected
              : styles.label
        }
      >
        {props.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  equalTrack: {
    flexDirection: "row",
    backgroundColor: theme.colors.muted,
    borderRadius: theme.radii.full,
    padding: theme.spacing.xs,
    minHeight: theme.hitTarget.field,
  },
  scroll: {
    flexGrow: 0,
    backgroundColor: "transparent",
  },
  scrollContent: {
    flexGrow: 0,
  },
  scrollTrack: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    flexGrow: 0,
    flexShrink: 0,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.muted,
    borderRadius: theme.radii.full,
    padding: theme.spacing.xs,
  },
  tab: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radii.full,
  },
  tabGrow: {
    flex: 1,
  },
  tabCompact: {
    flexShrink: 0,
    minHeight: theme.hitTarget.min,
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
    fontSize: theme.typography.base.fontSize,
  },
  labelSelected: {
    color: theme.colors.foreground,
    fontSize: theme.typography.base.fontSize,
    fontWeight: "600",
  },
  compactLabel: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
    fontWeight: "500",
  },
  compactLabelSelected: {
    color: theme.colors.foreground,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
    fontWeight: "500",
  },
}));
