import { View } from "react-native";
import { useRouter } from "expo-router";
import { ConstructionIcon } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { AppHeader, EmptyState } from "../../../components/ui";
import { detectLocale } from "../../../i18n/locale";
import { ordersCopy } from "../../../i18n/orders";

/**
 * Static `/orders/new` until SHO-213 ships staff-intake create.
 * EmptyState + back only — no `orders.create`, sheets, or line editing.
 */
export function OrderCreatePlaceholderScreen() {
  const copy = ordersCopy(detectLocale()).create;
  const { theme } = useUnistyles();
  const router = useRouter();

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      accessibilityLabel={copy.title}
      style={styles.screen}
    >
      <AppHeader
        title={copy.title}
        back={{
          onPress: () => {
            router.back();
          },
          accessibilityLabel: copy.backLabel,
        }}
      />
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

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  body: {
    flex: 1,
    justifyContent: "center",
  },
}));
