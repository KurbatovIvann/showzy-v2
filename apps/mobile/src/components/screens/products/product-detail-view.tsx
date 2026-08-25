import type { ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";
import {
  ImageIcon,
  PackageIcon,
  PencilIcon,
  WifiOffIcon,
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import {
  AppHeader,
  Banner,
  Button,
  EmptyState,
  IconButton,
  Sheet,
  StatusPill,
} from "../../ui";
import { ProductGallery } from "./product-gallery";
import { variantStatusActionLabel } from "./product-detail-model";
import { ProductVariantRow } from "./product-variant-row";
import type { ProductDetailModel } from "./use-product-detail";

export function ProductDetailView(model: ProductDetailModel) {
  const { copy } = model;
  const { theme } = useUnistyles();

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
        actions={
          model.canEdit && model.state.kind === "ready" ? (
            <View style={styles.headerActions}>
              <IconButton
                variant="surface"
                icon={
                  <ImageIcon
                    size={theme.iconSize.md}
                    color={theme.colors.foreground}
                  />
                }
                accessibilityLabel={copy.detail.photosManageLabel}
                onPress={model.openPhotos}
              />
              <IconButton
                variant="surface"
                icon={
                  <PencilIcon
                    size={theme.iconSize.md}
                    color={theme.colors.foreground}
                  />
                }
                accessibilityLabel={copy.detail.editLabel}
                onPress={model.openEdit}
              />
            </View>
          ) : undefined
        }
      />
      <ProductDetailBody model={model} />
      <Sheet
        visible={model.confirm !== null}
        title={model.confirmCopy?.title ?? ""}
        description={model.confirmCopy?.description ?? ""}
        onClose={model.closeConfirm}
      >
        {model.confirmBanner !== null && model.confirmBanner.length > 0 ? (
          <Banner message={model.confirmBanner} />
        ) : null}
        <Button
          label={model.confirmCopy?.confirmLabel ?? ""}
          loading={model.confirmPending}
          onPress={model.confirmStatusWrite}
        />
        <Button
          variant="secondary"
          label={copy.detail.cancel}
          disabled={model.confirmPending}
          onPress={model.closeConfirm}
        />
      </Sheet>
    </SafeAreaView>
  );
}

function ProductDetailBody(props: { readonly model: ProductDetailModel }) {
  const { model } = props;
  const { copy } = model;
  const { theme } = useUnistyles();
  const iconColor = theme.colors.mutedForeground;

  switch (model.state.kind) {
    case "loading":
      return (
        <View
          style={styles.skeletons}
          accessibilityLabel={copy.detail.loadingLabel}
        >
          <View style={styles.skeletonGallery} />
          <View style={[styles.skeletonLine, styles.skeletonName]} />
          <View style={[styles.skeletonLine, styles.skeletonPrice]} />
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
    case "ready":
      if (model.product === null) {
        return null;
      }
      return <ProductDetailReady model={model} />;
  }
}

function ProductDetailReady(props: { readonly model: ProductDetailModel }) {
  const { model } = props;
  const product = model.product;
  if (product === null) {
    return null;
  }
  const { copy } = model;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <ProductGallery
        key={product.id}
        fileIds={product.imageFileIds}
        canFetchImages={model.canFetchImages}
        emptyLabel={copy.detail.noPhotos}
        photosLabel={copy.detail.photosLabel}
      />
      <View style={styles.identity}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{product.name}</Text>
          {product.archived ? (
            <StatusPill label={copy.archivedBadge} tone="neutral" />
          ) : null}
        </View>
        <Text style={styles.price}>{product.priceLabel}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{copy.detail.variantsTitle}</Text>
        {product.variants.length === 0 ? (
          <Text style={styles.muted}>{copy.variants.none}</Text>
        ) : (
          <View style={styles.variantList}>
            {product.variants.map((variant) => (
              <ProductVariantRow
                key={variant.id}
                id={variant.id}
                name={variant.name}
                priceLabel={variant.priceLabel}
                priceInherited={variant.priceInherited}
                inheritedLabel={copy.detail.inheritedPrice}
                archived={variant.archived}
                archivedLabel={copy.archivedBadge}
                archiveLabel={copy.detail.archiveVariant}
                restoreLabel={copy.detail.restoreVariant}
                actionAccessibilityLabel={variantStatusActionLabel({
                  archived: variant.archived,
                  variantName: variant.name,
                  copy: copy.detail,
                })}
                canEdit={model.canEdit}
                onArchive={model.requestArchiveVariant}
                onRestore={model.requestRestoreVariant}
              />
            ))}
          </View>
        )}
      </View>
      {model.canEdit ? (
        <Button
          variant={product.archived ? "primary" : "secondary"}
          label={
            product.archived
              ? copy.detail.restoreProduct
              : copy.detail.archiveProduct
          }
          onPress={model.requestProductStatus}
        />
      ) : null}
    </ScrollView>
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing["3xl"],
    gap: theme.spacing.xl,
  },
  identity: {
    gap: theme.spacing.sm,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  name: {
    flexShrink: 1,
    color: theme.colors.foreground,
    fontSize: theme.typography.xl.fontSize,
    lineHeight: theme.typography.xl.lineHeight,
    fontWeight: "600",
  },
  price: {
    color: theme.colors.foreground,
    fontSize: theme.typography.lg.fontSize,
    lineHeight: theme.typography.lg.lineHeight,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  section: {
    gap: theme.spacing.md,
  },
  sectionTitle: {
    color: theme.colors.foreground,
    fontSize: theme.typography.base.fontSize,
    lineHeight: theme.typography.base.lineHeight,
    fontWeight: "600",
  },
  muted: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
  },
  variantList: {
    gap: theme.spacing.md,
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
  skeletonGallery: {
    aspectRatio: 4 / 3,
    borderRadius: theme.radii.card,
    ...theme.squircle,
    backgroundColor: theme.colors.skeleton,
  },
  skeletonLine: {
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.skeleton,
  },
  skeletonName: {
    height: theme.spacing.xl,
    width: "70%",
  },
  skeletonPrice: {
    height: theme.spacing.lg,
    width: "40%",
  },
}));
