import { useMemo, type ComponentProps } from "react";
import { Pressable, Text, View } from "react-native";
import type { Tabs } from "expo-router";
import {
  BoxIcon,
  MenuIcon,
  ShoppingBagIcon,
  SparklesIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { detectLocale } from "../../../i18n/locale";
import { panelCopy } from "../../../i18n/panel";
import { orderedPanelTabs, type PanelTab } from "./panel-tabs";

/**
 * Staff shell tab bar (canvas `BottomNav`, ADR-0024). Feature component —
 * not a generic tab primitive (mp-to-mobile.md). Rendered as the custom
 * `tabBar` of the `(app)/(tabs)` navigator; the AI center control is the
 * visually distinct `accent` tab. The AI tab hosts AssistantSheet
 * (SHO-323). Long-press voice capture is out of this slice.
 */
type TabBarProps = Parameters<
  NonNullable<ComponentProps<typeof Tabs>["tabBar"]>
>[0];

const tabIcons: Readonly<Record<PanelTab, LucideIcon>> = {
  orders: ShoppingBagIcon,
  products: BoxIcon,
  ai: SparklesIcon,
  customers: UsersIcon,
  more: MenuIcon,
};

export function BottomNav({ state, navigation, insets }: TabBarProps) {
  const copy = useMemo(() => panelCopy(detectLocale()), []);
  const { theme } = useUnistyles();
  const tabs = orderedPanelTabs(state.routes.map((route) => route.name));
  const activeTab = state.routes[state.index]?.name;

  const selectTab = (tab: PanelTab) => {
    const route = state.routes.find((candidate) => candidate.name === tab);
    if (route === undefined) {
      return;
    }
    const event = navigation.emit({
      type: "tabPress",
      target: route.key,
      canPreventDefault: true,
    });
    if (activeTab !== tab && !event.defaultPrevented) {
      navigation.navigate(route.name, route.params);
    }
  };

  return (
    <View
      accessibilityLabel={copy.navigation}
      style={[
        styles.wrapper,
        { paddingBottom: Math.max(theme.spacing.sm, insets.bottom) },
      ]}
    >
      <View accessibilityRole="tablist" style={styles.cluster}>
        {tabs.map((tab) =>
          tab === "ai" ? (
            <AiTab
              key={tab}
              label={copy.tabs.ai}
              active={activeTab === "ai"}
              onPress={() => {
                selectTab("ai");
              }}
            />
          ) : (
            <NavItem
              key={tab}
              tab={tab}
              label={copy.tabs[tab]}
              active={activeTab === tab}
              onPress={() => {
                selectTab(tab);
              }}
            />
          ),
        )}
      </View>
    </View>
  );
}

function NavItem(props: {
  readonly tab: PanelTab;
  readonly label: string;
  readonly active: boolean;
  readonly onPress: () => void;
}) {
  const { theme } = useUnistyles();
  const Icon = tabIcons[props.tab];
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={props.label}
      accessibilityState={{ selected: props.active }}
      onPress={props.onPress}
      style={[styles.item, props.active ? styles.itemActive : null]}
    >
      <Icon
        size={theme.iconSize.md}
        strokeWidth={props.active ? 2.2 : 1.7}
        color={props.active ? theme.colors.foreground : theme.colors.icon.muted}
      />
      <Text
        numberOfLines={1}
        style={[styles.itemLabel, props.active ? styles.itemLabelActive : null]}
      >
        {props.label}
      </Text>
    </Pressable>
  );
}

function AiTab(props: {
  readonly label: string;
  readonly active: boolean;
  readonly onPress: () => void;
}) {
  const { theme } = useUnistyles();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={props.label}
      accessibilityState={{ selected: props.active }}
      onPress={props.onPress}
      style={styles.aiSlot}
    >
      {({ pressed }) => (
        <>
          <View
            style={[styles.aiButton, pressed ? styles.aiButtonPressed : null]}
          >
            <SparklesIcon
              size={theme.iconSize.md}
              color={theme.colors.accentForeground}
            />
          </View>
          <Text style={styles.aiLabel}>{props.label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  wrapper: {
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.xs,
  },
  cluster: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.nav,
    ...theme.squircle,
    backgroundColor: theme.colors.card,
    paddingHorizontal: theme.spacing.xs,
    paddingTop: theme.spacing.xs,
    ...theme.shadows.nav,
  },
  item: {
    flex: 1,
    minHeight: theme.hitTarget.field,
    margin: theme.spacing.xs,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.xs,
    borderRadius: theme.radii.lg,
    ...theme.squircle,
  },
  itemActive: {
    backgroundColor: theme.colors.background,
  },
  itemLabel: {
    color: theme.colors.icon.muted,
    fontSize: theme.typography["2xs"].fontSize,
    lineHeight: theme.typography["2xs"].lineHeight,
    fontWeight: "500",
  },
  itemLabelActive: {
    color: theme.colors.foreground,
  },
  aiSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: theme.spacing.xs,
    marginVertical: theme.spacing.xs,
  },
  aiButton: {
    width: theme.hitTarget.min,
    height: theme.hitTarget.min,
    borderRadius: theme.radii.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.accent,
    ...theme.shadows.accent,
  },
  aiButtonPressed: {
    transform: [{ scale: 0.95 }],
  },
  aiLabel: {
    color: theme.colors.accent,
    fontSize: theme.typography["2xs"].fontSize,
    lineHeight: theme.typography["2xs"].lineHeight,
    fontWeight: "500",
  },
}));
