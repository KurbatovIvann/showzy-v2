import { useMemo } from "react";
import { View } from "react-native";
import { MailPlusIcon } from "lucide-react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { AppHeader, EmptyState } from "../../../components/ui";
import { customersCopy } from "../../../i18n/customers";
import { detectLocale } from "../../../i18n/locale";

/**
 * Route shell for `/customers/invitations/new` so the home `+` does not
 * 404. The create form (personal/reusable, pickers, copy token once) is
 * SHO-206.
 */
export function InvitationCreateShellScreen() {
  const locale = detectLocale();
  const copy = useMemo(() => customersCopy(locale), [locale]);
  const router = useRouter();
  const { theme } = useUnistyles();
  const iconColor = theme.colors.mutedForeground;

  return (
    <SafeAreaView
      edges={["top"]}
      accessibilityLabel={copy.createInviteLabel}
      style={styles.screen}
    >
      <AppHeader
        title={copy.createInviteLabel}
        back={{
          onPress: () => {
            router.back();
          },
          accessibilityLabel: copy.backLabel,
        }}
      />
      <View style={styles.centered}>
        <EmptyState
          icon={<MailPlusIcon size={theme.iconSize.md} color={iconColor} />}
          title={copy.editorStub.invitationCreateTitle}
          description={copy.editorStub.invitationCreateDescription}
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
  centered: {
    flex: 1,
    justifyContent: "center",
  },
}));
