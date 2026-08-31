import type { ReactNode } from "react";
import { View } from "react-native";
import { LockIcon, WifiOffIcon } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { AppHeader, Button, EmptyState } from "../ui";
import {
  formScaffoldBody,
  formScaffoldShowsFooter,
  formScaffoldShowsRetry,
  type FormScaffoldLoadKind,
} from "./form-scaffold-chrome";

export type FormScreenScaffoldFooter = {
  readonly cancelLabel: string;
  readonly submitLabel: string;
  readonly pending: boolean;
  readonly submitDisabled: boolean;
  readonly onCancel: () => void;
  readonly onSubmit: () => void;
};

export type FormScreenScaffoldEmpty = {
  readonly offlineTitle: string;
  readonly offlineDescription: string;
  readonly errorTitle: string;
  readonly errorDescription: string;
  readonly permissionTitle: string;
  readonly permissionDescription: string;
  readonly retryLabel: string;
};

export function FormScreenScaffold(props: {
  readonly title: string;
  readonly accessibilityLabel: string;
  readonly backLabel: string;
  readonly onBack: () => void;
  readonly loadKind: FormScaffoldLoadKind;
  readonly loadingLabel: string;
  readonly empty: FormScreenScaffoldEmpty;
  readonly onRetry?: () => void;
  readonly footer?: FormScreenScaffoldFooter;
  readonly children: ReactNode;
  readonly overlay?: ReactNode;
}) {
  const body = formScaffoldBody(props.loadKind);
  const showFooter = formScaffoldShowsFooter({
    loadKind: props.loadKind,
    hasFooter: props.footer !== undefined,
  });

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      accessibilityLabel={props.accessibilityLabel}
      style={styles.screen}
    >
      <AppHeader
        title={props.title}
        back={{
          onPress: props.onBack,
          accessibilityLabel: props.backLabel,
        }}
      />
      <FormScaffoldBody
        body={body}
        loadingLabel={props.loadingLabel}
        empty={props.empty}
        {...(props.onRetry !== undefined ? { onRetry: props.onRetry } : {})}
      >
        {props.children}
      </FormScaffoldBody>
      {showFooter && props.footer !== undefined ? (
        <FormScaffoldFooter footer={props.footer} />
      ) : null}
      {props.overlay !== undefined ? props.overlay : null}
    </SafeAreaView>
  );
}

function FormScaffoldBody(props: {
  readonly body: ReturnType<typeof formScaffoldBody>;
  readonly loadingLabel: string;
  readonly empty: FormScreenScaffoldEmpty;
  readonly onRetry?: () => void;
  readonly children: ReactNode;
}) {
  const { theme } = useUnistyles();
  const iconColor = theme.colors.mutedForeground;
  const retry =
    props.onRetry !== undefined &&
    formScaffoldShowsRetry(props.body === "skeleton" ? "loading" : props.body)
      ? props.onRetry
      : undefined;

  switch (props.body) {
    case "skeleton":
      return (
        <View style={styles.skeletons} accessibilityLabel={props.loadingLabel}>
          <View style={[styles.skeletonLine, styles.skeletonName]} />
          <View style={[styles.skeletonLine, styles.skeletonPrice]} />
          <View style={styles.skeletonCard} />
        </View>
      );
    case "offline":
      return (
        <CenteredEmpty>
          <EmptyState
            icon={<WifiOffIcon size={theme.iconSize.md} color={iconColor} />}
            title={props.empty.offlineTitle}
            description={props.empty.offlineDescription}
            action={
              retry !== undefined ? (
                <Button
                  variant="secondary"
                  label={props.empty.retryLabel}
                  onPress={retry}
                />
              ) : undefined
            }
          />
        </CenteredEmpty>
      );
    case "error":
      return (
        <CenteredEmpty>
          <EmptyState
            icon={<WifiOffIcon size={theme.iconSize.md} color={iconColor} />}
            title={props.empty.errorTitle}
            description={props.empty.errorDescription}
            action={
              retry !== undefined ? (
                <Button
                  variant="secondary"
                  label={props.empty.retryLabel}
                  onPress={retry}
                />
              ) : undefined
            }
          />
        </CenteredEmpty>
      );
    case "permission":
      return (
        <CenteredEmpty>
          <EmptyState
            icon={<LockIcon size={theme.iconSize.md} color={iconColor} />}
            title={props.empty.permissionTitle}
            description={props.empty.permissionDescription}
          />
        </CenteredEmpty>
      );
    case "ready":
      return <>{props.children}</>;
  }
}

function FormScaffoldFooter(props: {
  readonly footer: FormScreenScaffoldFooter;
}) {
  const { footer } = props;
  return (
    <View style={styles.footer}>
      <View style={styles.footerActions}>
        <View style={styles.footerButton}>
          <Button
            variant="secondary"
            fullWidth
            label={footer.cancelLabel}
            disabled={footer.pending}
            onPress={footer.onCancel}
          />
        </View>
        <View style={styles.footerButton}>
          <Button
            fullWidth
            label={footer.submitLabel}
            loading={footer.pending}
            disabled={footer.submitDisabled}
            onPress={footer.onSubmit}
          />
        </View>
      </View>
    </View>
  );
}

function CenteredEmpty({ children }: { readonly children: ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  footerActions: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  footerButton: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
  },
  skeletons: {
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  skeletonLine: {
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.skeleton,
  },
  skeletonName: {
    height: theme.hitTarget.field,
    width: "100%",
  },
  skeletonPrice: {
    height: theme.hitTarget.field,
    width: "60%",
  },
  skeletonCard: {
    height: theme.hitTarget.row,
    borderRadius: theme.radii.xl,
    ...theme.squircle,
    backgroundColor: theme.colors.skeleton,
  },
}));
