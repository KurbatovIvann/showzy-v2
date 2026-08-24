import { useMemo } from "react";
import { Text, View } from "react-native";
import { ConstructionIcon } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { detectLocale } from "../../../i18n/locale";
import { panelCopy } from "../../../i18n/panel";
import { EmptyState } from "../../ui";
import type { PanelTab } from "./panel-tabs";

/**
 * One parameterized placeholder for every tab until its product screen
 * ships (SHO-122, owner decision 2 — the AI tab is a plain placeholder
 * too; the assistant sheet is phase 9 / vm-T29). Zero product data, zero
 * contract calls. Bottom inset is owned by the tab bar.
 */
export function PanelPlaceholderScreen({ tab }: { readonly tab: PanelTab }) {
  const copy = useMemo(() => panelCopy(detectLocale()), []);
  const { theme } = useUnistyles();
  const title = copy.tabs[tab];

  return (
    <SafeAreaView
      edges={["top"]}
      accessibilityLabel={title}
      style={styles.screen}
    >
      <Text style={styles.title}>{title}</Text>
      <View style={styles.body}>
        <EmptyState
          icon={
            <ConstructionIcon
              size={theme.iconSize.md}
              color={theme.colors.mutedForeground}
            />
          }
          title={copy.placeholderTitle}
          description={copy.placeholderDescription}
        />
      </View>
    </SafeAreaView>
  );
}

export function OrdersPlaceholderScreen() {
  return <PanelPlaceholderScreen tab="orders" />;
}

export function ProductsPlaceholderScreen() {
  return <PanelPlaceholderScreen tab="products" />;
}

export function AiPlaceholderScreen() {
  return <PanelPlaceholderScreen tab="ai" />;
}

export function CustomersPlaceholderScreen() {
  return <PanelPlaceholderScreen tab="customers" />;
}

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  title: {
    color: theme.colors.foreground,
    marginTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    fontSize: theme.typography.xl.fontSize,
    lineHeight: theme.typography.xl.lineHeight,
    fontWeight: "600",
  },
  body: {
    flex: 1,
    justifyContent: "center",
  },
}));
