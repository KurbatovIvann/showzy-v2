/**
 * Web / tests: tab bar + the selected scene. Native swipe lives in
 * `tab-view.native.tsx` (`PagerView`).
 */
import { View } from "react-native";
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
  const { selectedIndex, mountedIndices, selectIndex } = useTabViewSelection({
    tabs: props.tabs,
    initialTabIndex: options.initialTabIndex,
    lazy: options.lazy,
    onTabChange: props.onTabChange,
  });
  const selected = props.tabs[selectedIndex];

  return (
    <TabViewFrame
      tabs={props.tabs}
      selectedIndex={selectedIndex}
      onTabPress={selectIndex}
      renderTabBar={props.renderTabBar}
      scrollableTabs={options.scrollableTabs}
    >
      <View style={styles.page}>
        {selected !== undefined &&
        (!options.lazy || mountedIndices.has(selectedIndex))
          ? props.renderScene(selected.key, selectedIndex)
          : null}
      </View>
    </TabViewFrame>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
});
