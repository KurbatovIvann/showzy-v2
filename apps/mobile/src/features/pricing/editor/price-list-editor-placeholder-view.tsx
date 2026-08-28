import { useMemo } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { ConstructionIcon, TagsIcon } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { AppHeader, EmptyState } from "../../../components/ui";
import { detectLocale } from "../../../i18n/locale";
import { pricingCopy } from "../../../i18n/pricing";

export function PriceListEditorPlaceholderView(props: {
  readonly mode: "create" | "edit";
  readonly missing?: boolean;
}) {
  const copy = useMemo(() => pricingCopy(detectLocale()), []);
  const { theme } = useUnistyles();
  const router = useRouter();
  const title =
    props.mode === "create" ? copy.stub.createTitle : copy.stub.editTitle;
  const missing = props.missing === true;

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
            missing ? (
              <TagsIcon
                size={theme.iconSize.md}
                color={theme.colors.mutedForeground}
              />
            ) : (
              <ConstructionIcon
                size={theme.iconSize.md}
                color={theme.colors.mutedForeground}
              />
            )
          }
          title={
            missing ? copy.stub.notFoundTitle : copy.stub.placeholderTitle
          }
          description={
            missing
              ? copy.stub.notFoundDescription
              : copy.stub.placeholderDescription
          }
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
