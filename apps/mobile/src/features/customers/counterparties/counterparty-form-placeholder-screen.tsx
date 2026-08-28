import { useMemo } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { BuildingIcon } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { AppHeader, EmptyState } from "../../../components/ui";
import { customersCopy } from "../../../i18n/customers";
import { detectLocale } from "../../../i18n/locale";

/**
 * Create/edit placeholder until SHO-196 ships the counterparty form.
 * Routes exist so the list `+` / Edit affordances navigate; no contract
 * writes happen here.
 */
export function CounterpartyCreatePlaceholderScreen() {
  return <CounterpartyFormPlaceholderScreen mode="create" />;
}

export function CounterpartyEditPlaceholderScreen() {
  return <CounterpartyFormPlaceholderScreen mode="edit" />;
}

function CounterpartyFormPlaceholderScreen(props: {
  readonly mode: "create" | "edit";
}) {
  const locale = detectLocale();
  const copy = useMemo(() => customersCopy(locale), [locale]);
  const { theme } = useUnistyles();
  const router = useRouter();
  const title =
    props.mode === "create"
      ? copy.editorStub.counterpartyCreateTitle
      : copy.editorStub.counterpartyEditTitle;

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
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
            <BuildingIcon
              size={theme.iconSize.md}
              color={theme.colors.mutedForeground}
            />
          }
          title={copy.editorStub.counterpartyPlaceholderTitle}
          description={copy.editorStub.counterpartyPlaceholderDescription}
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
