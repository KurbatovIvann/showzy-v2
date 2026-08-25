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
 * Route stubs for the create/edit form (SHO-139) and photo attach
 * (SHO-141) screens so detail navigation works before those tickets.
 * Zero product data, zero contract calls.
 */
function ProductStubScreen({ title }: { readonly title: string }) {
  const locale = detectLocale();
  const copy = useMemo(() => productsCopy(locale), [locale]);
  const placeholder = useMemo(() => panelCopy(locale), [locale]);
  const { theme } = useUnistyles();
  const router = useRouter();

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

export function ProductCreateStubScreen() {
  const copy = productsCopy(detectLocale());
  return <ProductStubScreen title={copy.stub.createTitle} />;
}

export function ProductEditStubScreen() {
  const copy = productsCopy(detectLocale());
  return <ProductStubScreen title={copy.stub.editTitle} />;
}

export function ProductPhotosStubScreen() {
  const copy = productsCopy(detectLocale());
  return <ProductStubScreen title={copy.stub.photosTitle} />;
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
