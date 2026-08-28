/**
 * Canvas `AuthModeSwitch` / customers tab strip (`CustomersScreen` tabs,
 * not `BottomNav`). `layout="equal"` is the two-up auth row.
 * `layout="scroll"` is the overflowing CRM strip: full-bleed scroller,
 * content-sized muted track, optional `contentPaddingHorizontal` so the
 * track lines up with a padded column and still scrolls to the edge.
 * The selected state is a sliding pill (v1 SegmentedControl), not a
 * per-tab background.
 */
import { useEffect, useRef } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import Animated from "react-native-reanimated";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { scrollXToRevealTab } from "./segmented-tabs.layout";
import { useSegmentedPill } from "./use-segmented-pill";

export type SegmentedTabsLayout = "equal" | "scroll";

export function SegmentedTabs<K extends string>(props: {
  readonly tabs: ReadonlyArray<{ readonly key: K; readonly label: string }>;
  readonly selected: K;
  readonly onSelect: (key: K) => void;
  readonly disabled?: boolean;
  readonly layout?: SegmentedTabsLayout;
  /**
   * Leading/trailing inset inside the scroller so the track lines up with
   * a padded column. Scrolls to the screen edge — not a mask.
   */
  readonly contentPaddingHorizontal?: number;
}) {
  const layout = props.layout ?? "equal";
  if (layout === "scroll") {
    return (
      <ScrollableSegmentedTabs
        tabs={props.tabs}
        selected={props.selected}
        onSelect={props.onSelect}
        disabled={props.disabled === true}
        contentPaddingHorizontal={props.contentPaddingHorizontal ?? 0}
      />
    );
  }
  return (
    <EqualSegmentedTabs
      tabs={props.tabs}
      selected={props.selected}
      onSelect={props.onSelect}
      disabled={props.disabled === true}
    />
  );
}

function EqualSegmentedTabs<K extends string>(props: {
  readonly tabs: ReadonlyArray<{ readonly key: K; readonly label: string }>;
  readonly selected: K;
  readonly onSelect: (key: K) => void;
  readonly disabled: boolean;
}) {
  const { onTabLayout, pillStyle } = useSegmentedPill(props.selected);
  return (
    <View style={styles.equalTrack} accessibilityRole="tablist">
      <View collapsable={false} style={styles.equalInner}>
        <Animated.View pointerEvents="none" style={[styles.pill, pillStyle]} />
        {props.tabs.map((tab) => (
          <SegmentedTab
            key={tab.key}
            label={tab.label}
            selected={tab.key === props.selected}
            disabled={props.disabled}
            grow
            onLayout={(event) => {
              onTabLayout(tab.key, event);
            }}
            onPress={() => {
              props.onSelect(tab.key);
            }}
          />
        ))}
      </View>
    </View>
  );
}

function ScrollableSegmentedTabs<K extends string>(props: {
  readonly tabs: ReadonlyArray<{ readonly key: K; readonly label: string }>;
  readonly selected: K;
  readonly onSelect: (key: K) => void;
  readonly disabled: boolean;
  readonly contentPaddingHorizontal: number;
}) {
  const { theme } = useUnistyles();
  const edgePadding = props.contentPaddingHorizontal;
  const gutter = edgePadding > 0 ? edgePadding : theme.spacing.sm;
  const scrollRef = useRef<ScrollView>(null);
  const viewportWidth = useRef(0);
  const contentWidth = useRef(0);
  const tabMetrics = useRef<Partial<Record<K, { x: number; width: number }>>>(
    {},
  );
  const { onTabLayout, pillStyle } = useSegmentedPill(props.selected);

  function reveal(key: K): void {
    const tab = tabMetrics.current[key];
    if (tab === undefined) {
      return;
    }
    scrollRef.current?.scrollTo({
      x: scrollXToRevealTab({
        tabX: tab.x + edgePadding,
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
        tabX: tab.x + edgePadding,
        tabWidth: tab.width,
        viewportWidth: viewportWidth.current,
        contentWidth: contentWidth.current,
        gutter,
      }),
      animated: true,
    });
  }, [edgePadding, gutter, props.selected]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      accessibilityRole="tablist"
      showsHorizontalScrollIndicator={false}
      bounces={false}
      alwaysBounceHorizontal={false}
      overScrollMode="never"
      fadingEdgeLength={0}
      automaticallyAdjustContentInsets={false}
      contentInsetAdjustmentBehavior="never"
      contentInset={{ left: 0, right: 0 }}
      style={styles.scroll}
      contentContainerStyle={[
        styles.scrollContent,
        edgePadding > 0 ? { paddingHorizontal: edgePadding } : null,
      ]}
      onLayout={(event: LayoutChangeEvent) => {
        viewportWidth.current = event.nativeEvent.layout.width;
      }}
      onContentSizeChange={(width) => {
        contentWidth.current = width;
      }}
    >
      <View style={styles.scrollTrack}>
        <View collapsable={false} style={styles.scrollInner}>
          <Animated.View
            pointerEvents="none"
            style={[styles.pill, pillStyle]}
          />
          {props.tabs.map((tab) => (
            <SegmentedTab
              key={tab.key}
              label={tab.label}
              selected={tab.key === props.selected}
              disabled={props.disabled}
              compact
              onLayout={(event) => {
                tabMetrics.current[tab.key] = {
                  x: event.nativeEvent.layout.x,
                  width: event.nativeEvent.layout.width,
                };
                onTabLayout(tab.key, event);
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
  equalInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "stretch",
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
    backgroundColor: theme.colors.muted,
    borderRadius: theme.radii.full,
    padding: theme.spacing.xs,
  },
  scrollInner: {
    flexDirection: "row",
    alignItems: "center",
    flexGrow: 0,
    flexShrink: 0,
    gap: theme.spacing.sm,
  },
  pill: {
    position: "absolute",
    top: 0,
    bottom: 0,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.card,
    ...theme.shadows.sm,
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
