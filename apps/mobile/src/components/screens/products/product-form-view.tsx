import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { LockIcon, PackageIcon, WifiOffIcon } from "lucide-react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import {
  AppHeader,
  Banner,
  Button,
  EmptyState,
  StatusPill,
  TextField,
} from "../../ui";
import type { ProductFormVariantDraft } from "./product-form-model";
import type { ProductFormModel } from "./use-product-form";

const UAH_PREFIX = "₴";

export function ProductFormView(model: ProductFormModel) {
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
      <ProductFormBody model={model} />
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
  const { copy, draft } = model;
  const form = copy.form;
  const { theme } = useUnistyles();

  return (
    <KeyboardAwareScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      bottomOffset={theme.spacing.lg}
    >
      <TextField
        label={form.nameLabel}
        value={draft.name}
        onChangeText={model.changeName}
        placeholder={form.namePlaceholder}
        accessibilityLabel={form.nameLabel}
        keyboardType="default"
        autoCapitalize="sentences"
        autoCorrect
        autoComplete="off"
        maxLength={model.nameMaxLength}
        editable={model.fieldsEditable}
        error={model.nameError}
      />
      <TextField
        label={form.priceLabel}
        value={draft.priceText}
        onChangeText={model.changePrice}
        placeholder={form.pricePlaceholder}
        accessibilityLabel={form.priceLabel}
        keyboardType="decimal-pad"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        editable={model.fieldsEditable}
        prefix={UAH_PREFIX}
        error={model.priceError}
      />
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{form.variantsTitle}</Text>
        {draft.variants.length === 0 ? (
          <Text style={styles.muted}>{copy.variants.none}</Text>
        ) : (
          <View style={styles.variantList}>
            {draft.variants.map((variant) => (
              <ProductFormVariantCard
                key={variant.key}
                variant={variant}
                archivedLabel={copy.archivedBadge}
                nameLabel={form.variantNameLabel}
                namePlaceholder={form.variantNamePlaceholder}
                priceLabel={form.variantPriceLabel}
                pricePlaceholder={form.variantPricePlaceholder}
                inheritHint={form.inheritHint}
                removeLabel={form.removeVariant}
                nameError={model.variantErrors[variant.key]?.name ?? null}
                priceError={model.variantErrors[variant.key]?.price ?? null}
                editable={model.fieldsEditable}
                nameMaxLength={model.nameMaxLength}
                onChangeName={model.changeVariantName}
                onChangePrice={model.changeVariantPrice}
                onRemove={model.removeVariant}
              />
            ))}
          </View>
        )}
        <Button
          variant="secondary"
          label={form.addVariant}
          disabled={!model.canAddVariant}
          onPress={model.addVariant}
        />
      </View>
      {model.banner !== null && model.banner.length > 0 ? (
        <Banner message={model.banner} />
      ) : null}
      <Button
        label={model.submitLabel}
        loading={model.pending}
        disabled={model.submitDisabled}
        onPress={model.save}
      />
    </KeyboardAwareScrollView>
  );
}

function ProductFormVariantCard(props: {
  readonly variant: ProductFormVariantDraft;
  readonly archivedLabel: string;
  readonly nameLabel: string;
  readonly namePlaceholder: string;
  readonly priceLabel: string;
  readonly pricePlaceholder: string;
  readonly inheritHint: string;
  readonly removeLabel: string;
  readonly nameError: string | null;
  readonly priceError: string | null;
  readonly editable: boolean;
  readonly nameMaxLength: number;
  readonly onChangeName: (key: string, value: string) => void;
  readonly onChangePrice: (key: string, value: string) => void;
  readonly onRemove: (key: string) => void;
}) {
  const { variant } = props;
  const canRemove = variant.variantId === null;
  const showHeader = variant.archived || canRemove;

  return (
    <View style={styles.variantCard}>
      {showHeader ? (
        <View style={styles.variantHeader}>
          {variant.archived ? (
            <StatusPill label={props.archivedLabel} tone="neutral" />
          ) : null}
          {canRemove ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={props.removeLabel}
              disabled={!props.editable}
              onPress={() => {
                props.onRemove(variant.key);
              }}
              style={({ pressed }) => [
                styles.remove,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={styles.removeLabel}>{props.removeLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <TextField
        label={props.nameLabel}
        value={variant.name}
        onChangeText={(value) => {
          props.onChangeName(variant.key, value);
        }}
        placeholder={props.namePlaceholder}
        accessibilityLabel={props.nameLabel}
        keyboardType="default"
        autoCapitalize="sentences"
        autoCorrect
        autoComplete="off"
        maxLength={props.nameMaxLength}
        editable={props.editable}
        error={props.nameError}
      />
      <View>
        <TextField
          label={props.priceLabel}
          value={variant.priceText}
          onChangeText={(value) => {
            props.onChangePrice(variant.key, value);
          }}
          placeholder={props.pricePlaceholder}
          accessibilityLabel={props.priceLabel}
          keyboardType="decimal-pad"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          editable={props.editable}
          prefix={UAH_PREFIX}
          error={props.priceError}
        />
        {variant.priceText.trim().length === 0 ? (
          <Text style={styles.hint}>{props.inheritHint}</Text>
        ) : null}
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
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing["3xl"],
    gap: theme.spacing.xl,
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
  variantCard: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.xl,
    ...theme.squircle,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.md,
    ...theme.shadows.sm,
  },
  variantHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: theme.spacing.sm,
  },
  remove: {
    minHeight: theme.hitTarget.min,
    marginLeft: "auto",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.sm,
  },
  removeLabel: {
    color: theme.colors.destructive,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.85,
  },
  hint: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
    marginTop: theme.spacing.sm,
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
