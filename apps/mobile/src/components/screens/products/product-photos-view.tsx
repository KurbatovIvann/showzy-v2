import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import {
  ImageIcon,
  LockIcon,
  PackageIcon,
  WifiOffIcon,
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { AppHeader, Banner, Button, EmptyState, Sheet } from "../../ui";
import { ProductImagePicker } from "./product-image-picker";
import type { ProductPhotosModel } from "./use-product-photos";

export function ProductPhotosView(model: ProductPhotosModel) {
  const { copy } = model;

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      accessibilityLabel={model.headerTitle}
      style={styles.screen}
    >
      <AppHeader
        title={model.headerTitle}
        back={{
          onPress: model.goBack,
          accessibilityLabel: copy.backLabel,
        }}
      />
      <ProductPhotosBody model={model} />
      <Sheet
        visible={model.pickerOpen}
        title={copy.photos.pickTitle}
        description={copy.photos.pickDescription}
        onClose={model.closePicker}
      >
        <Button label={copy.photos.addCamera} onPress={model.pickCamera} />
        <Button
          variant="secondary"
          label={copy.photos.addLibrary}
          onPress={model.pickLibrary}
        />
        <Button
          variant="ghost"
          label={copy.photos.closeSheet}
          onPress={model.closePicker}
        />
      </Sheet>
      <Sheet
        visible={model.denied !== null}
        title={
          model.denied === "camera"
            ? copy.photos.cameraDeniedTitle
            : copy.photos.libraryDeniedTitle
        }
        description={
          model.denied === "camera"
            ? copy.photos.cameraDeniedDescription
            : copy.photos.libraryDeniedDescription
        }
        onClose={model.closeDenied}
      >
        <Button label={copy.photos.closeSheet} onPress={model.closeDenied} />
      </Sheet>
    </SafeAreaView>
  );
}

function ProductPhotosBody(props: { readonly model: ProductPhotosModel }) {
  const { model } = props;
  const { copy } = model;
  const { theme } = useUnistyles();
  const iconColor = theme.colors.mutedForeground;
  const photos = copy.photos;

  switch (model.state.kind) {
    case "loading":
      return (
        <View
          style={styles.skeletons}
          accessibilityLabel={copy.detail.loadingLabel}
        >
          <View style={styles.skeletonRow}>
            <View style={styles.skeletonTile} />
            <View style={styles.skeletonTile} />
            <View style={styles.skeletonTile} />
          </View>
        </View>
      );
    case "offline":
      return (
        <CenteredEmpty>
          <EmptyState
            icon={<WifiOffIcon size={theme.iconSize.md} color={iconColor} />}
            title={copy.detail.offlineTitle}
            description={copy.detail.offlineDescription}
            action={
              <Button
                variant="secondary"
                label={copy.detail.retry}
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
            title={copy.detail.errorTitle}
            description={copy.detail.errorDescription}
            action={
              <Button
                variant="secondary"
                label={copy.detail.retry}
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
            icon={<PackageIcon size={theme.iconSize.md} color={iconColor} />}
            title={copy.detail.notFoundTitle}
            description={copy.detail.notFoundDescription}
          />
        </CenteredEmpty>
      );
    case "permission":
      return (
        <CenteredEmpty>
          <EmptyState
            icon={<LockIcon size={theme.iconSize.md} color={iconColor} />}
            title={photos.permissionTitle}
            description={photos.permissionDescription}
          />
        </CenteredEmpty>
      );
    case "ready":
      return (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {model.tiles.length === 0 ? (
            <EmptyState
              icon={<ImageIcon size={theme.iconSize.md} color={iconColor} />}
              title={photos.emptyTitle}
              description={photos.emptyDescription}
              action={
                model.canAdd ? (
                  <Button label={photos.addLabel} onPress={model.openPicker} />
                ) : undefined
              }
            />
          ) : (
            <ProductImagePicker
              tiles={model.tiles}
              copy={photos}
              previewByFileId={model.previewByFileId}
              canAdd={model.canAdd}
              onAdd={model.openPicker}
              onRemove={model.removePhoto}
              onMoveEarlier={model.moveEarlier}
              onMoveLater={model.moveLater}
              onRetry={model.retryUpload}
              onCancel={model.cancelUpload}
            />
          )}
          {model.banner !== null && model.banner.length > 0 ? (
            <Banner message={model.banner} />
          ) : null}
          {model.canRetryCommit ? (
            <Button
              variant="secondary"
              label={photos.retryLabel}
              loading={model.commitPending}
              onPress={model.retryCommit}
            />
          ) : null}
        </ScrollView>
      );
  }
}

function CenteredEmpty({ children }: { readonly children: ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing["3xl"],
    gap: theme.spacing.xl,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
  },
  skeletons: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  skeletonRow: {
    flexDirection: "row",
    gap: theme.spacing.md,
  },
  skeletonTile: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: theme.radii.lg,
    ...theme.squircle,
    backgroundColor: theme.colors.skeleton,
  },
}));
