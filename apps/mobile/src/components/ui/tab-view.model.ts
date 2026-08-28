/**
 * Index / lazy-mount helpers for `TabView`. Pure so pager chrome can be
 * tested without `react-native-pager-view`.
 */

export type TabDefinition<K extends string = string> = {
  readonly key: K;
  readonly label: string;
};

export type TabBarProps<K extends string = string> = {
  readonly tabs: ReadonlyArray<TabDefinition<K>>;
  readonly selectedIndex: number;
  readonly onTabPress: (index: number) => void;
  readonly scrollable: boolean;
};

export function indexOfTabKey<K extends string>(
  tabs: ReadonlyArray<{ readonly key: K }>,
  key: K,
): number {
  return tabs.findIndex((tab) => tab.key === key);
}

export function nextMountedIndices(
  mounted: ReadonlySet<number>,
  index: number,
): ReadonlySet<number> {
  if (mounted.has(index)) {
    return mounted;
  }
  const next = new Set(mounted);
  next.add(index);
  return next;
}

export function resolveTabViewOptions(props: {
  readonly initialTabIndex?: number;
  readonly swipeEnabled?: boolean;
  readonly lazy?: boolean;
  readonly offscreenPageLimit?: number;
  readonly scrollableTabs?: boolean;
}): {
  readonly initialTabIndex: number;
  readonly swipeEnabled: boolean;
  readonly lazy: boolean;
  readonly offscreenPageLimit: number;
  readonly scrollableTabs: boolean;
} {
  return {
    initialTabIndex: props.initialTabIndex ?? 0,
    swipeEnabled: props.swipeEnabled !== false,
    lazy: props.lazy === true,
    offscreenPageLimit: props.offscreenPageLimit ?? 1,
    scrollableTabs: props.scrollableTabs === true,
  };
}
