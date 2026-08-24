import type { ReactNode } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Building2Icon, RefreshCwIcon } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import type { CompanyResolutionCopy } from "../../../i18n/company-resolution";
import { Button, EmptyState } from "../../ui";

export function CompanyResolutionLoading(props: { readonly label: string }) {
  const { theme } = useUnistyles();
  return (
    <View accessible accessibilityLabel={props.label} style={styles.loading}>
      <ActivityIndicator color={theme.colors.activityIndicator.onBackground} />
      <Text style={styles.loadingLabel}>{props.label}</Text>
    </View>
  );
}

export function CompanyResolutionError(props: {
  readonly copy: CompanyResolutionCopy;
  readonly retrying: boolean;
  readonly onRetry: () => void;
}) {
  const { theme } = useUnistyles();
  return (
    <ResolutionScreen label={props.copy.errorTitle}>
      <EmptyState
        icon={
          <RefreshCwIcon
            size={theme.iconSize.md}
            color={theme.colors.mutedForeground}
          />
        }
        title={props.copy.errorTitle}
        description={props.copy.errorDescription}
        action={
          <Button
            label={props.copy.retry}
            loading={props.retrying}
            onPress={props.onRetry}
          />
        }
      />
    </ResolutionScreen>
  );
}

export function MultipleCompaniesStub(props: {
  readonly copy: CompanyResolutionCopy;
  readonly onSignOut: () => void;
}) {
  const { theme } = useUnistyles();
  return (
    <ResolutionScreen label={props.copy.multipleTitle}>
      <EmptyState
        icon={
          <Building2Icon
            size={theme.iconSize.md}
            color={theme.colors.mutedForeground}
          />
        }
        title={props.copy.multipleTitle}
        description={props.copy.multipleDescription}
        action={
          <Button
            label={props.copy.signOut}
            variant="ghost"
            onPress={props.onSignOut}
          />
        }
      />
    </ResolutionScreen>
  );
}

function ResolutionScreen(props: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <SafeAreaView
      accessible
      accessibilityLabel={props.label}
      style={styles.screen}
    >
      {props.children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: theme.colors.background,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.md,
    backgroundColor: theme.colors.background,
  },
  loadingLabel: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
  },
}));
