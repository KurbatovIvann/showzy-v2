import { useMemo } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { ConstructionIcon } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { detectLocale } from "../../../i18n/locale";
import { panelCopy } from "../../../i18n/panel";
import { productsCopy } from "../../../i18n/products";
import { AppHeader, EmptyState } from "../../ui";

/**
 * Route stub for the photo attach screen (SHO-141) so detail navigation
 * works before that ticket. Zero product data, zero contract calls.
 */
export function ProductPhotosStubScreen() {
  const locale = detectLocale();
  const copy = useMemo(() => productsCopy(locale), [locale]);
  const placeholder = useMemo(() => panelCopy(locale), [locale]);
  const { theme } = useUnistyles();
  const router = useRouter();
  const title = copy.stub.photosTitle;

  return (
    <SafeAreaView
      edges={["top"]}
      accessibilityLabel={title}
      style={styles.screen}
    >
      <AppHeader
        title={title}
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
          title={placeholder.placeholderTitle}
          description={placeholder.placeholderDescription}
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
