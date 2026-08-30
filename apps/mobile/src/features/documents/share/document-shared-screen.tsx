/**
 * In-app public token screen (SHO-238). Thin: download when the stored
 * PDF URL is set, otherwise ask the sender to refresh. Not a cabinet.
 */
import type { ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";
import { FileTextIcon, LockIcon, WifiOffIcon } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { AppHeader, Button, EmptyState } from "../../../components/ui";
import type { DocumentSharedModel } from "./use-document-shared";
import { useDocumentShared } from "./use-document-shared";

export function DocumentSharedScreen() {
  const model = useDocumentShared();
  return <DocumentSharedView {...model} />;
}

function DocumentSharedView(model: DocumentSharedModel) {
  const { theme } = useUnistyles();
  const iconColor = theme.colors.mutedForeground;

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      accessibilityLabel={model.copy.title}
      style={styles.screen}
    >
      <AppHeader
        title={model.copy.title}
        back={{
          onPress: model.goBack,
          accessibilityLabel: model.copy.backLabel,
        }}
      />
      <DocumentSharedBody model={model} iconColor={iconColor} />
    </SafeAreaView>
  );
}

function DocumentSharedBody(props: {
  readonly model: DocumentSharedModel;
  readonly iconColor: string;
}) {
  const { model, iconColor } = props;
  const { theme } = useUnistyles();

  switch (model.state.kind) {
    case "loading":
      return (
        <CenteredEmpty>
          <View accessibilityLabel={model.copy.loadingLabel}>
            <ActivityIndicator
              color={theme.colors.activityIndicator.onBackground}
            />
          </View>
        </CenteredEmpty>
      );
    case "offline":
      return (
        <CenteredEmpty>
          <EmptyState
            icon={<WifiOffIcon size={theme.iconSize.md} color={iconColor} />}
            title={model.copy.offlineTitle}
            description={model.copy.offlineDescription}
            action={
              <Button
                variant="secondary"
                label={model.copy.retry}
                onPress={model.retry}
              />
            }
          />
        </CenteredEmpty>
      );
    case "error":
      return (
        <CenteredEmpty>
          <EmptyState
            icon={<WifiOffIcon size={theme.iconSize.md} color={iconColor} />}
            title={model.copy.errorTitle}
            description={model.copy.errorDescription}
            action={
              <Button
                variant="secondary"
                label={model.copy.retry}
                onPress={model.retry}
              />
            }
          />
        </CenteredEmpty>
      );
    case "not-found":
      return (
        <CenteredEmpty>
          <EmptyState
            icon={<LockIcon size={theme.iconSize.md} color={iconColor} />}
            title={model.copy.notFoundTitle}
            description={model.copy.notFoundDescription}
          />
        </CenteredEmpty>
      );
    case "ready":
      return (
        <View style={styles.ready}>
          {model.state.downloadUrl !== null ? (
            <Button
              fullWidth
              label={model.copy.download}
              onPress={model.download}
            />
          ) : (
            <EmptyState
              icon={<FileTextIcon size={theme.iconSize.md} color={iconColor} />}
              title={model.copy.title}
              description={model.copy.refresh}
            />
          )}
          {model.state.signedDownloadUrl !== null ? (
            <Button
              fullWidth
              variant={
                model.state.downloadUrl !== null ? "secondary" : "primary"
              }
              label={model.copy.downloadSigned}
              onPress={model.downloadSigned}
            />
          ) : null}
        </View>
      );
  }
}

function CenteredEmpty(props: { readonly children: ReactNode }) {
  return <View style={styles.centered}>{props.children}</View>;
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
  ready: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.md,
  },
}));
