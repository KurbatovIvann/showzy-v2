import { useMemo } from "react";
import { View } from "react-native";
import { FileTextIcon, LockIcon } from "lucide-react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { AppHeader, EmptyState } from "../../../components/ui";
import { useResolvedCompany } from "../../../company-resolution/resolved-company-provider";
import { detectLocale } from "../../../i18n/locale";
import { companiesCopy } from "../../../i18n/companies";
import { canViewCompanySettings } from "../shared/company-permissions";
import { classifyCompanyLegalStub } from "./company-settings.presenter";

/**
 * Legal editor stub (SHO-226). SHO-225 owns the form; this route exists
 * so the hub can href to `/more/company/legal` without a 404. The
 * `canViewCompanySettings` gate stays here so the editor ticket inherits
 * it — no `companies.get` on this screen.
 */
export function CompanyLegalStubScreen() {
  const copy = useMemo(() => companiesCopy(detectLocale()), []);
  const router = useRouter();
  const { theme } = useUnistyles();
  const membership = useResolvedCompany();
  const state = classifyCompanyLegalStub({
    canView: canViewCompanySettings(membership.role),
  });
  const iconColor = theme.colors.mutedForeground;

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
        {state.kind === "permission" ? (
          <EmptyState
            icon={<LockIcon size={theme.iconSize.md} color={iconColor} />}
            title={copy.permissionTitle}
            description={copy.permissionDescription}
          />
        ) : (
          <EmptyState
            icon={<FileTextIcon size={theme.iconSize.md} color={iconColor} />}
            title={copy.legalLabel}
            description={copy.legalStubDescription}
          />
        )}
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
