import { useMemo } from "react";
import { View } from "react-native";
import { FileTextIcon } from "lucide-react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { AppHeader, EmptyState } from "../../../components/ui";
import { detectLocale } from "../../../i18n/locale";
import { companiesCopy } from "../../../i18n/companies";

/**
 * Legal editor stub (SHO-226). SHO-225 owns the form; this route exists
 * so the hub can href to `/more/company/legal` without a 404.
 */
export function CompanyLegalStubScreen() {
  const copy = useMemo(() => companiesCopy(detectLocale()), []);
  const router = useRouter();
  const { theme } = useUnistyles();

  return (
    <SafeAreaView
      edges={["top"]}
      accessibilityLabel={copy.legalLabel}
      style={styles.screen}
    >
      <AppHeader
        title={copy.legalLabel}
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
            <FileTextIcon
              size={theme.iconSize.md}
              color={theme.colors.mutedForeground}
            />
          }
          title={copy.legalLabel}
          description={copy.legalStubDescription}
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
