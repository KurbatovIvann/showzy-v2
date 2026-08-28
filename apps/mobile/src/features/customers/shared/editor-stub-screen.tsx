import { useRouter } from "expo-router";
import { ConstructionIcon } from "lucide-react-native";
import { useMemo } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { AppHeader, EmptyState } from "../../../components/ui";
import { customersCopy } from "../../../i18n/customers";
import { detectLocale } from "../../../i18n/locale";

export type CustomerEditorStubKind =
  | "client-create"
  | "client-edit"
  | "group-create"
  | "group-edit";

/** Placeholder until SHO-180 / SHO-181 land the real forms. */
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
    readonly clientCreateTitle: string;
    readonly clientEditTitle: string;
    readonly groupCreateTitle: string;
    readonly groupEditTitle: string;
  },
): string {
  switch (kind) {
    case "client-create":
      return copy.clientCreateTitle;
    case "client-edit":
      return copy.clientEditTitle;
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
