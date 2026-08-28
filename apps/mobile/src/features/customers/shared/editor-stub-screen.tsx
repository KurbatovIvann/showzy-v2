import { useRouter } from "expo-router";
import { ConstructionIcon } from "lucide-react-native";
import { useMemo } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { AppHeader, EmptyState } from "../../../components/ui";
import { customersCopy } from "../../../i18n/customers";
import { detectLocale } from "../../../i18n/locale";

export type CustomerEditorStubKind = "group-create" | "group-edit";

/** Placeholder until SHO-181 lands the group form. */
export function CustomerEditorStubScreen(props: {
  readonly kind: CustomerEditorStubKind;
}) {
  const locale = detectLocale();
  const copy = useMemo(() => customersCopy(locale), [locale]);
  const router = useRouter();
  const { theme } = useUnistyles();
  const title = stubTitle(props.kind, copy.editorStub);

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
      <EmptyState
        icon={
          <ConstructionIcon
            size={theme.iconSize.md}
            color={theme.colors.mutedForeground}
          />
        }
        title={copy.editorStub.title}
        description={copy.editorStub.description}
      />
    </SafeAreaView>
  );
}

function stubTitle(
  kind: CustomerEditorStubKind,
  copy: {
    readonly groupCreateTitle: string;
    readonly groupEditTitle: string;
  },
): string {
  switch (kind) {
    case "group-create":
      return copy.groupCreateTitle;
    case "group-edit":
      return copy.groupEditTitle;
  }
}

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
}));
