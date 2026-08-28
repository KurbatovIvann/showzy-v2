import { useCallback, useMemo, useState, type ReactNode } from "react";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { SegmentedTabs } from "./segmented-tabs";
import {
  indexOfTabKey,
  nextMountedIndices,
  type TabBarProps,
  type TabDefinition,
} from "./tab-view.model";

export type TabViewProps<K extends string> = {
  readonly tabs: ReadonlyArray<TabDefinition<K>>;
  readonly renderScene: (key: K, index: number) => ReactNode;
  readonly renderTabBar?: (bar: TabBarProps<K>) => ReactNode;
  readonly initialTabIndex?: number;
  readonly onTabChange?: (index: number, key: K) => void;
  readonly swipeEnabled?: boolean;
  readonly lazy?: boolean;
  readonly offscreenPageLimit?: number;
  readonly scrollableTabs?: boolean;
};

export function useTabViewSelection<K extends string>(args: {
  readonly tabs: ReadonlyArray<TabDefinition<K>>;
  readonly initialTabIndex: number;
  readonly lazy: boolean;
  readonly onTabChange: ((index: number, key: K) => void) | undefined;
}): {
  readonly selectedIndex: number;
  readonly mountedIndices: ReadonlySet<number>;
  readonly selectIndex: (index: number) => void;
} {
  const [selectedIndex, setSelectedIndex] = useState(args.initialTabIndex);
  const [mountedIndices, setMountedIndices] = useState<ReadonlySet<number>>(
    () => new Set([args.initialTabIndex]),
  );

  const selectIndex = useCallback(
    (index: number) => {
      const tab = args.tabs[index];
      if (tab === undefined) {
        return;
      }
      setSelectedIndex(index);
      args.onTabChange?.(index, tab.key);
      if (args.lazy) {
        setMountedIndices((prev) => nextMountedIndices(prev, index));
      }
    },
    [args.lazy, args.onTabChange, args.tabs],
  );

  return { selectedIndex, mountedIndices, selectIndex };
}

function DefaultTabBar<K extends string>(props: TabBarProps<K>) {
  const selected = props.tabs[props.selectedIndex];
  if (selected === undefined) {
    return null;
  }
  return (
    <View style={styles.tabBarWrapper}>
      <SegmentedTabs
        tabs={props.tabs}
        selected={selected.key}
        onSelect={(key) => {
          const index = indexOfTabKey(props.tabs, key);
          if (index >= 0) {
            props.onTabPress(index);
          }
        }}
        {...(props.scrollable ? { layout: "scroll" as const } : {})}
      />
    </View>
  );
}

export function TabViewFrame<K extends string>(props: {
  readonly tabs: ReadonlyArray<TabDefinition<K>>;
  readonly selectedIndex: number;
  readonly onTabPress: (index: number) => void;
  readonly renderTabBar: ((bar: TabBarProps<K>) => ReactNode) | undefined;
  readonly scrollableTabs: boolean;
  readonly children: ReactNode;
}) {
  const tabBarProps = useMemo<TabBarProps<K>>(
    () => ({
      tabs: props.tabs,
      selectedIndex: props.selectedIndex,
      onTabPress: props.onTabPress,
      scrollable: props.scrollableTabs,
    }),
    [props.onTabPress, props.scrollableTabs, props.selectedIndex, props.tabs],
  );

  return (
    <View style={styles.container}>
      {props.renderTabBar !== undefined ? (
        props.renderTabBar(tabBarProps)
      ) : (
        <DefaultTabBar {...tabBarProps} />
      )}
      {props.children}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
  },
  tabBarWrapper: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
  },
}));
