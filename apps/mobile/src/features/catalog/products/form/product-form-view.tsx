import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import {
  LockIcon,
  PackageIcon,
  PlusIcon,
  WifiOffIcon,
} from "lucide-react-native";
import { useWatch } from "react-hook-form";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { interpolate } from "../../../../i18n/locale";
import {
  AppHeader,
  Banner,
  Button,
  EditorFooter,
  EmptyState,
} from "../../../../components/ui";
import { PhotoSourceSheet } from "../photos/photo-source-sheet";
import { firstVariantFieldError } from "./product-form-copy";
import {
  formatProductFormFooterPrice,
  productFormFooterPriceMuted,
  type ProductFormVariantDraft,
} from "./product-form-draft";
import {
  ProductFormNameField,
  ProductFormPriceField,
  useProductFormPriceLabel,
} from "./product-form-fields";
import { ProductFormVariantRow } from "./product-form-variant-row";
import { VariantEditorSheet } from "./variant-editor-sheet";
import {
  ProductImagePicker,
  photoCountLabel,
} from "../photos/product-image-picker";
import type { ProductFormModel } from "./use-product-form";

export function ProductFormView(model: ProductFormModel) {
  const { copy } = model;
  const form = copy.form;

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      accessibilityLabel={model.headerTitle}
      style={styles.screen}
    >
      <AppHeader
        title={model.headerTitle}
        back={{
          onPress: model.requestLeave,
          accessibilityLabel: copy.backLabel,
        }}
      />
      <ProductFormBody model={model} />
      {model.state.kind === "ready" ? (
        <ProductFormEditorFooter model={model} />
      ) : null}
      <VariantEditorSheet
        visible={model.variantSheet.kind !== "closed"}
        mode={model.variantSheet.kind === "edit" ? "edit" : "new"}
        initial={model.variantSheetInitial}
        copy={form}
        nameMaxLength={model.nameMaxLength}
        editable={model.fieldsEditable}
        onClose={model.closeVariantSheet}
        onSave={model.saveVariantFromSheet}
      />
      <PhotoSourceSheet
        visible={model.photos.pickerOpen}
        copy={copy.photos}
        onClose={model.photos.closePicker}
        onHidden={model.photos.onSourceSheetHidden}
        onCamera={model.photos.pickCamera}
        onLibrary={model.photos.pickLibrary}
      />
    </SafeAreaView>
  );
}

function ProductFormBody(props: { readonly model: ProductFormModel }) {
  const { model } = props;
  const { copy } = model;
  const { theme } = useUnistyles();
  const iconColor = theme.colors.mutedForeground;
  const form = copy.form;

  switch (model.state.kind) {
    case "loading":
      return (
        <View
          style={styles.skeletons}
          accessibilityLabel={copy.detail.loadingLabel}
        >
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
              model.mode === "edit" ? (
                <Button
                  variant="secondary"
                  label={copy.detail.retry}
                  onPress={model.retry}
                />
              ) : undefined
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
            title={
              model.mode === "create"
                ? form.permissionCreateTitle
                : form.permissionEditTitle
            }
            description={
              model.mode === "create"
                ? form.permissionCreateDescription
                : form.permissionEditDescription
            }
          />
        </CenteredEmpty>
      );
    case "ready":
      return <ProductFormReady model={model} />;
  }
}

function ProductFormReady(props: { readonly model: ProductFormModel }) {
  const { model } = props;
  const { copy, variants } = model;
  const form = copy.form;
  const { theme } = useUnistyles();
  const productPriceLabel = useProductFormPriceLabel(model.control);

  return (
    <KeyboardAwareScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      bottomOffset={theme.spacing.lg}
    >
      <ProductFormSection title={form.detailsTitle}>
        <ProductFormNameField
          control={model.control}
          copy={form}
          mode={model.mode}
          originName={model.originName}
          nameMaxLength={model.nameMaxLength}
          editable={model.fieldsEditable}
          error={model.nameError}
          onFieldEdit={model.onFieldEdit}
        />
      </ProductFormSection>
      <ProductFormSection
        title={copy.photos.title}
        accessory={photoCountLabel(
          copy.photos.count,
          model.photos.tiles.length,
        )}
      >
        <ProductImagePicker
          tiles={model.photos.tiles}
          copy={copy.photos}
          previewByFileId={model.photos.previewByFileId}
          canAdd={model.photos.canAdd && model.fieldsEditable}
          readOnly={!model.fieldsEditable}
          banner={model.photos.banner}
          onAdd={model.photos.openPicker}
          onRemove={model.photos.removePhoto}
          onMoveEarlier={model.photos.moveEarlier}
          onMoveLater={model.photos.moveLater}
          onRetry={model.photos.retryUpload}
          onCancel={model.photos.cancelUpload}
        />
        {model.photos.canRetryCommit ? (
          <Button
            variant="secondary"
            label={copy.photos.retryLabel}
            loading={model.photos.commitPending}
            onPress={model.photos.retryCommit}
          />
        ) : null}
      </ProductFormSection>
      <ProductFormSection title={form.priceSectionTitle}>
        <ProductFormPriceField
          control={model.control}
          copy={form}
          mode={model.mode}
          originPriceText={model.originPriceText}
          editable={model.fieldsEditable}
          error={model.priceError}
          onFieldEdit={model.onFieldEdit}
        />
        <Text style={styles.hint}>{form.priceHint}</Text>
      </ProductFormSection>
      <ProductFormSection title={form.variantsTitle}>
        {variants.length === 0 ? (
          <View style={styles.variantsEmpty}>
            <Text style={styles.variantsEmptyTitle}>
              {form.variantsEmptyTitle}
            </Text>
            <Text style={styles.muted}>{form.variantsEmptyDescription}</Text>
          </View>
        ) : (
          <View style={styles.variantList}>
            {variants.map((variant) => (
              <ProductFormVariantRow
                key={variant.key}
                id={variant.key}
                name={variant.name}
                priceLabel={variantPriceLabel(
                  form.variantInheritedPrice,
                  variant,
                  productPriceLabel,
                )}
                archived={variant.archived}
                archivedLabel={copy.archivedBadge}
                editLabel={form.variantSheetEditTitle}
                error={firstVariantFieldError(model.variantErrors[variant.key])}
                disabled={!model.fieldsEditable}
                onPress={model.openEditVariant}
              />
            ))}
          </View>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={form.addVariant}
          disabled={!model.canAddVariant}
          onPress={model.openNewVariant}
          style={({ pressed }) => [
            styles.addVariant,
            pressed && model.canAddVariant ? styles.pressed : null,
            !model.canAddVariant ? styles.addVariantDisabled : null,
          ]}
        >
          <PlusIcon size={theme.iconSize.sm} color={theme.colors.foreground} />
          <Text style={styles.addVariantLabel}>{form.addVariant}</Text>
        </Pressable>
      </ProductFormSection>
      {model.banner !== null && model.banner.length > 0 ? (
        <Banner message={model.banner} />
      ) : null}
    </KeyboardAwareScrollView>
  );
}

function ProductFormEditorFooter(props: { readonly model: ProductFormModel }) {
  const { model } = props;
  const form = model.copy.form;
  const priceText = useWatch({ control: model.control, name: "priceText" });
  return (
    <EditorFooter
      cancelLabel={form.cancel}
      confirmLabel={model.submitLabel}
      confirming={model.pending}
      confirmDisabled={model.submitDisabled}
      cancelDisabled={model.pending}
      onCancel={model.requestLeave}
      onConfirm={model.save}
      metaLabel={form.footerBasePrice}
      metaValue={formatProductFormFooterPrice(priceText)}
      metaValueMuted={productFormFooterPriceMuted(priceText)}
    />
  );
}

function variantPriceLabel(
  template: string,
  variant: ProductFormVariantDraft,
  productPriceLabel: string,
): string {
  if (variant.priceText.trim().length === 0) {
    return interpolate(template, { price: productPriceLabel });
  }
  return formatProductFormFooterPrice(variant.priceText);
}

function ProductFormSection(props: {
  readonly title: string;
  readonly accessory?: string;
  readonly children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>{props.title}</Text>
        {props.accessory !== undefined && props.accessory.length > 0 ? (
          <Text style={styles.sectionAccessory}>{props.accessory}</Text>
        ) : null}
      </View>
      <View style={styles.sectionCard}>{props.children}</View>
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
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.xl,
  },
  section: {
    gap: theme.spacing.sm,
  },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.xs,
  },
  sectionTitle: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
    fontWeight: "600",
  },
  sectionAccessory: {
    color: theme.colors.icon.muted,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
    fontVariant: ["tabular-nums"],
  },
  sectionCard: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.card,
    ...theme.squircle,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    ...theme.shadows.sm,
  },
  hint: {
    color: theme.colors.icon.muted,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
  },
  muted: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
  },
  variantsEmpty: {
    backgroundColor: theme.colors.inputFill,
    borderRadius: theme.radii.lg,
    ...theme.squircle,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    gap: theme.spacing.xs,
  },
  variantsEmptyTitle: {
    color: theme.colors.foreground,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
    fontWeight: "600",
  },
  variantList: {
    gap: theme.spacing.sm,
  },
  addVariant: {
    minHeight: theme.hitTarget.min + theme.spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: theme.colors.icon.muted,
    borderRadius: theme.radii.lg,
    ...theme.squircle,
  },
  addVariantDisabled: {
    opacity: 0.5,
  },
  addVariantLabel: {
    color: theme.colors.foreground,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.85,
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
