/**
 * Native swipeable scenes under a `SegmentedTabs` bar (v1 `TabView` +
 * PagerView). Pill chrome is `SegmentedTabs`; this file owns pager sync,
 * lazy mount, and the tab-press → `setPage` path. Not `BottomNav`.
 */
import { useCallback, useRef } from "react";
import { Platform, View } from "react-native";
import PagerView, {
  type PagerViewOnPageSelectedEvent,
} from "react-native-pager-view";
import { StyleSheet } from "react-native-unistyles";

import {
  TabViewFrame,
  useTabViewSelection,
  type TabViewProps,
} from "./tab-view-frame";
import {
  resolveTabViewOptions,
  type TabBarProps,
  type TabDefinition,
} from "./tab-view.model";

export type { TabBarProps, TabDefinition, TabViewProps };

export function TabView<K extends string>(props: TabViewProps<K>) {
  const options = resolveTabViewOptions(props);
  const pagerRef = useRef<PagerView>(null);
  const { selectedIndex, mountedIndices, selectIndex } = useTabViewSelection({
    tabs: props.tabs,
    initialTabIndex: options.initialTabIndex,
    lazy: options.lazy,
    onTabChange: props.onTabChange,
  });

  const handleTabPress = useCallback(
    (index: number) => {
      selectIndex(index);
      const pager = pagerRef.current;
      if (pager === null) {
        return;
      }
      if (Platform.OS === "ios") {
        requestAnimationFrame(() => {
          pager.setPage(index);
        });
        return;
      }
      pager.setPage(index);
    },
    [selectIndex],
  );

  const handlePageSelected = useCallback(
    (event: PagerViewOnPageSelectedEvent) => {
      selectIndex(event.nativeEvent.position);
    },
    [selectIndex],
  );

  return (
    <TabViewFrame
      tabs={props.tabs}
      selectedIndex={selectedIndex}
      onTabPress={handleTabPress}
      renderTabBar={props.renderTabBar}
      scrollableTabs={options.scrollableTabs}
    >
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={options.initialTabIndex}
        scrollEnabled={options.swipeEnabled}
        onPageSelected={handlePageSelected}
        offscreenPageLimit={options.offscreenPageLimit}
      >
        {props.tabs.map((tab, index) => (
          <View key={tab.key} collapsable={false} style={styles.page}>
            {!options.lazy || mountedIndices.has(index)
              ? props.renderScene(tab.key, index)
              : null}
          </View>
        ))}
      </PagerView>
    </TabViewFrame>
  );
}

const styles = StyleSheet.create({
  pager: {
    flex: 1,
  },
  page: {
    width: "100%",
    height: "100%",
  },
});
