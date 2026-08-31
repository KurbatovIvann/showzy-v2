import { useEffect, useRef, type ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";
import {
  CameraIcon,
  MoreHorizontalIcon,
  PackageIcon,
  PencilIcon,
  PlusIcon,
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
  StatusPill,
} from "../../../../components/ui";
import { PhotoSourceSheet } from "../photos/photo-source-sheet";
import { ProductActionsSheet } from "./product-actions-sheet";
import { VariantEditorSheet } from "../form/variant-editor-sheet";
import { ProductImagePicker } from "../photos/product-image-picker";
import { ProductVariantRow } from "./product-variant-row";
import { VariantActionsSheet } from "./variant-actions-sheet";
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
        subtitle={model.headerSubtitle}
        back={{
          onPress: model.goBack,
          accessibilityLabel: copy.backLabel,
        }}
        actions={
          model.canEdit && model.state.kind === "ready" ? (
            <IconButton
              variant="secondary"
              icon={
                <MoreHorizontalIcon
                  size={theme.iconSize.md}
                  color={theme.colors.foreground}
                />
              }
              accessibilityLabel={copy.detail.productActionsLabel}
              onPress={model.openProductActions}
            />
          ) : undefined
        }
      />
      <ProductDetailBody model={model} />
      {model.canEdit &&
      model.state.kind === "ready" &&
      model.product !== null ? (
        <View style={styles.footer}>
          <View style={styles.footerButton}>
            <Button
              fullWidth
              icon={
                <PencilIcon
                  size={theme.iconSize.sm}
                  color={theme.colors.primaryForeground}
                />
              }
              label={copy.detail.editLabel}
              onPress={model.openEdit}
            />
          </View>
          <View style={styles.footerButton}>
            <Button
              variant="secondary"
              fullWidth
              icon={
                <CameraIcon
                  size={theme.iconSize.sm}
                  color={theme.colors.foreground}
                />
              }
              label={copy.detail.photosLabel}
              onPress={model.openPhotos}
            />
          </View>
        </View>
      ) : null}
      <ProductActionsSheet
        visible={model.productActionsVisible}
        archived={model.product?.archived === true}
        copy={copy.detail}
        photosLabel={copy.detail.photosLabel}
        onClose={model.closeProductActions}
        onHidden={model.onProductActionsHidden}
        onEdit={() => {
          model.onProductSheetAction("edit");
        }}
        onPhotos={() => {
          model.onProductSheetAction("photos");
        }}
        onStatus={() => {
          model.onProductSheetAction("status");
        }}
      />
      <VariantActionsSheet
        visible={model.variantActionsVisible}
        title={model.variantActionsTitle}
        archived={model.variantActionsArchived}
        copy={copy.detail}
        onClose={model.closeVariantActions}
        onHidden={model.onVariantActionsHidden}
        onEdit={() => {
          model.onVariantSheetAction("edit");
        }}
        onStatus={() => {
          model.onVariantSheetAction("status");
        }}
      />
      <VariantEditorSheet
        visible={model.variantEditorVisible}
        mode={model.variantEditorMode}
        initial={model.variantSheetInitial}
        copy={copy.form}
        nameMaxLength={model.nameMaxLength}
        editable={!model.variantPending}
        banner={model.variantBanner}
        onClose={model.closeVariantEditor}
        onSave={model.saveVariantFromSheet}
      />
      <PhotoSourceSheet
        visible={model.canEdit && model.photos.pickerOpen}
        copy={copy.photos}
        onClose={model.photos.closePicker}
        onHidden={model.photos.onSourceSheetHidden}
        onCamera={model.photos.pickCamera}
        onLibrary={model.photos.pickLibrary}
      />
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
          <View style={styles.skeletonPhotos} />
          <View style={styles.skeletonCard} />
          <View style={styles.skeletonCard} />
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
  const { copy } = model;
  const { theme } = useUnistyles();
  const scrollRef = useRef<ScrollView>(null);
  const photoY = useRef(0);

  useEffect(() => {
    if (model.photosFocus === 0) {
      return;
    }
    scrollRef.current?.scrollTo({ y: photoY.current, animated: true });
  }, [model.photosFocus]);

  const product = model.product;
  const facts = model.facts;
  if (product === null || facts === null) {
    return null;
  }
  const form = copy.form;

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.identity}>
        <StatusPill label={facts.statusLabel} tone={facts.statusTone} />
        <Text style={styles.price}>{product.priceLabel}</Text>
      </View>
      <View
        onLayout={(event) => {
          photoY.current = event.nativeEvent.layout.y;
        }}
        style={styles.photosCard}
      >
        <ProductImagePicker
          tiles={model.photoTiles}
          copy={copy.photos}
          previewByFileId={model.previewByFileId}
          canAdd={model.canEdit && model.photos.canAdd}
          readOnly={!model.canEdit}
          showHeading
          banner={model.canEdit ? model.photos.banner : model.viewerPhotoBanner}
          onAdd={model.photos.openPicker}
          onRemove={model.photos.removePhoto}
          onMoveEarlier={model.photos.moveEarlier}
          onMoveLater={model.photos.moveLater}
          onRetry={model.photos.retryUpload}
          onCancel={model.photos.cancelUpload}
        />
        {model.canEdit && model.photos.canRetryCommit ? (
          <Button
            variant="secondary"
            label={copy.photos.retryLabel}
            loading={model.photos.commitPending}
            onPress={model.photos.retryCommit}
          />
        ) : null}
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{copy.detail.factsTitle}</Text>
        <View style={styles.factsCard}>
          <FactRow
            label={copy.detail.factStatus}
            value={
              <StatusPill label={facts.statusLabel} tone={facts.statusTone} />
            }
          />
          <FactRow label={form.priceLabel} value={facts.priceLabel} />
          <FactRow
            label={copy.detail.variantsTitle}
            value={facts.variantsLabel}
            last
          />
        </View>
      </View>
      <View style={styles.section}>
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>{copy.detail.variantsTitle}</Text>
          {model.canAddVariant && product.variants.length > 0 ? (
            <Button
              variant="ghost"
              icon={
                <PlusIcon
                  size={theme.iconSize.sm}
                  color={theme.colors.primary}
                />
              }
              label={form.addVariant}
              onPress={model.openNewVariant}
            />
          ) : null}
        </View>
        <View style={styles.variantsCard}>
          {product.variants.length === 0 ? (
            <View style={styles.variantsEmpty}>
              <Text style={styles.variantsEmptyTitle}>
                {form.variantsEmptyTitle}
              </Text>
              <Text style={styles.muted}>{form.variantsEmptyDescription}</Text>
              {model.canAddVariant ? (
                <Button
                  variant="secondary"
                  icon={
                    <PlusIcon
                      size={theme.iconSize.sm}
                      color={theme.colors.foreground}
                    />
                  }
                  label={form.addVariant}
                  onPress={model.openNewVariant}
                />
              ) : null}
            </View>
          ) : (
            <View style={styles.variantList}>
              {product.variants.map((variant) => (
                <ProductVariantRow
                  key={variant.id}
                  id={variant.id}
                  name={variant.name}
                  priceLabel={model.variantPriceLabel(variant)}
                  archived={variant.archived}
                  archivedLabel={copy.archivedBadge}
                  accessibilityLabel={model.variantAccessibilityLabel(variant)}
                  canEdit={model.canEdit}
                  onPress={model.openVariantActions}
                />
              ))}
            </View>
          )}
        </View>
      </View>
      {model.statusBanner !== null && model.statusBanner.length > 0 ? (
        <Banner message={model.statusBanner} />
      ) : null}
      {model.variantBanner !== null &&
      model.variantBanner.length > 0 &&
      !model.variantEditorVisible ? (
        <Banner message={model.variantBanner} />
      ) : null}
    </ScrollView>
  );
}

function FactRow(props: {
  readonly label: string;
  readonly value: ReactNode;
  readonly last?: boolean;
}) {
  return (
    <View
      style={[styles.factRow, props.last === true ? null : styles.factDivider]}
    >
      <Text style={styles.factLabel}>{props.label}</Text>
      {typeof props.value === "string" ? (
        <Text style={styles.factValue}>{props.value}</Text>
      ) : (
        <View style={styles.factValueSlot}>{props.value}</View>
      )}
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
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.xl,
  },
  photosCard: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.card,
    ...theme.squircle,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    ...theme.shadows.sm,
  },
  identity: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  price: {
    color: theme.colors.foreground,
    fontSize: theme.typography.lg.fontSize,
    lineHeight: theme.typography.lg.lineHeight,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  section: {
    gap: theme.spacing.sm,
  },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },
  sectionTitle: {
    paddingHorizontal: theme.spacing.xs,
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
    fontWeight: "600",
  },
  factsCard: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.card,
    ...theme.squircle,
    paddingHorizontal: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  factRow: {
    minHeight: theme.hitTarget.min,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.lg,
  },
  factDivider: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  factLabel: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
  },
  factValue: {
    flexShrink: 1,
    textAlign: "right",
    color: theme.colors.foreground,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
    fontWeight: "600",
  },
  factValueSlot: {
    flexShrink: 1,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  variantsCard: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.card,
    ...theme.squircle,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  variantList: {
    gap: theme.spacing.sm,
  },
  variantsEmpty: {
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
  },
  variantsEmptyTitle: {
    color: theme.colors.foreground,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
    fontWeight: "600",
  },
  muted: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
  },
  footer: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
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
  skeletonPhotos: {
    height: 160,
    borderRadius: theme.radii.card,
    ...theme.squircle,
    backgroundColor: theme.colors.skeleton,
  },
  skeletonCard: {
    height: theme.hitTarget.row,
    borderRadius: theme.radii.card,
    ...theme.squircle,
    backgroundColor: theme.colors.skeleton,
  },
}));
