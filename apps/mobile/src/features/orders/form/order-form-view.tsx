/**
 * Canvas OrderEditor as create-only (SHO-242).
 * Shared: AppHeader, Button, TextField, SearchField, Sheet, EmptyState, Banner.
 * Feature: SelectorRow, EditorSection, OrderLineCard, QuantityStepper,
 * ProductSelectSheet, OptionSelectSheet (customers + variants).
 * Omitted: payment, delivery, due date, status picker, discount, line
 * prices, and «До сплати» (owner decision 2 — footer is line count).
 */
import type { ReactNode } from "react";
import { Text, View } from "react-native";
import {
  LockIcon,
  PackagePlusIcon,
  UserIcon,
  WifiOffIcon,
} from "lucide-react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { LIST_PRODUCTS_QUERY_MAX_LENGTH } from "@showzy/validation/catalog";
import { LIST_CUSTOMERS_SEARCH_MAX } from "@showzy/validation/customers";

import { AppHeader, Banner, Button, EmptyState } from "../../../components/ui";
import { EditorSection } from "./editor-section";
import { OrderFormCommentField } from "./order-form-fields";
import { OrderLineCard } from "./order-line-card";
import { OptionSelectSheet } from "./option-select-sheet";
import { ProductSelectSheet } from "./product-select-sheet";
import { SelectorRow } from "./selector-row";
import type { OrderFormModel } from "./use-order-form";

export function OrderFormView(model: OrderFormModel) {
  const form = model.copy.create;

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      accessibilityLabel={form.title}
      style={styles.screen}
    >
      <AppHeader
        title={form.title}
        back={{
          onPress: model.requestLeave,
          accessibilityLabel: form.backLabel,
        }}
      />
      <OrderFormBody model={model} />
      {model.state.kind === "ready" && model.showSubmit ? (
        <View style={styles.footerDock}>
          <View style={styles.footerCard}>
            <Text style={styles.footerLines}>{model.footerLinesLabel}</Text>
            <View style={styles.footerActions}>
              <View style={styles.footerButton}>
                <Button
                  variant="secondary"
                  fullWidth
                  label={form.cancel}
                  disabled={model.pending}
                  onPress={model.requestLeave}
                />
              </View>
              <View style={styles.footerButton}>
                <Button
                  fullWidth
                  label={model.submitLabel}
                  loading={model.pending}
                  disabled={model.submitDisabled}
                  onPress={model.save}
                />
              </View>
            </View>
          </View>
        </View>
      ) : null}
      <OptionSelectSheet
        visible={model.customerSheetOpen}
        title={form.customerSheetTitle}
        searchPlaceholder={form.customerSearchPlaceholder}
        searchLabel={form.customerSearchLabel}
        closeLabel={model.copy.closeSheet}
        emptyLabel={form.emptyCustomers}
        value={model.selectedCustomerId}
        options={model.customerOptions}
        searchMaxLength={LIST_CUSTOMERS_SEARCH_MAX}
        leading="user"
        onClose={model.closeCustomerSheet}
        onChange={model.pickCustomer}
      />
      <ProductSelectSheet
        visible={model.productSheetOpen}
        title={form.productSheetTitle}
        searchPlaceholder={form.productSearchPlaceholder}
        searchLabel={form.productSearchLabel}
        closeLabel={model.copy.closeSheet}
        emptyLabel={form.emptyProducts}
        doneLabel={form.productSheetDone}
        thumbnailFailedLabel={form.thumbnailUnavailable}
        searchMaxLength={LIST_PRODUCTS_QUERY_MAX_LENGTH}
        selectedIds={model.selectedProductIds}
        doneCount={model.productPickCount}
        products={model.productSelectRows}
        onClose={model.closeProductSheet}
        onToggle={model.toggleProduct}
        onConfirm={model.confirmProductPicks}
      />
      <OptionSelectSheet
        visible={model.variantSheetOpen}
        title={form.variantSheetTitle}
        searchPlaceholder={form.productSearchPlaceholder}
        searchLabel={form.productSearchLabel}
        closeLabel={model.copy.closeSheet}
        emptyLabel={model.variantsReady ? form.emptyVariants : ""}
        value={null}
        options={model.variantOptions}
        searchMaxLength={LIST_PRODUCTS_QUERY_MAX_LENGTH}
        onClose={model.closeVariantSheet}
        onChange={model.pickVariant}
      />
    </SafeAreaView>
  );
}

function OrderFormBody(props: { readonly model: OrderFormModel }) {
  const { model } = props;
  const { theme } = useUnistyles();
  const iconColor = theme.colors.mutedForeground;
  const form = model.copy.create;

  switch (model.state.kind) {
    case "error":
      return (
        <CenteredEmpty>
          <EmptyState
            icon={<WifiOffIcon size={theme.iconSize.md} color={iconColor} />}
            title={model.copy.empty.errorTitle}
            description={form.errors.unavailable}
          />
        </CenteredEmpty>
      );
    case "permission":
      return (
        <CenteredEmpty>
          <EmptyState
            icon={<LockIcon size={theme.iconSize.md} color={iconColor} />}
            title={form.permissionTitle}
            description={form.permissionDescription}
          />
        </CenteredEmpty>
      );
    case "ready":
      return <OrderFormReady model={model} />;
  }
}

function OrderFormReady(props: { readonly model: OrderFormModel }) {
  const { model } = props;
  const { theme } = useUnistyles();
  const form = model.copy.create;

  return (
    <KeyboardAwareScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      bottomOffset={theme.spacing.lg}
    >
      {model.banner !== null ? <Banner message={model.banner} /> : null}
      <EditorSection title={form.itemsTitle}>
        {model.items.map((item, index) => {
          const thumbnail = model.lineThumbnail(item.productId);
          return (
            <OrderLineCard
              key={item.key}
              item={item}
              copy={form}
              editable={model.fieldsEditable}
              thumbnailFileId={thumbnail.fileId}
              thumbnailUrl={thumbnail.url}
              thumbnailFailed={thumbnail.failed}
              onStep={(delta) => {
                model.stepLine(index, delta);
              }}
              onRemove={() => {
                model.removeLine(index);
              }}
            />
          );
        })}
        <SelectorRow
          label={form.addProductsLabel}
          value={model.productsValue}
          placeholder={form.addProductsPlaceholder}
          icon={
            <PackagePlusIcon
              size={theme.iconSize.sm}
              color={theme.colors.mutedForeground}
            />
          }
          error={model.itemsError}
          disabled={!model.fieldsEditable}
          onPress={model.openProductsSheet}
        />
      </EditorSection>
      <EditorSection title={form.customerTitle}>
        <SelectorRow
          label={form.customerLabel}
          value={model.customerName}
          subtitle={model.customerPhone}
          placeholder={form.customerPlaceholder}
          icon={
            <UserIcon
              size={theme.iconSize.sm}
              color={theme.colors.mutedForeground}
            />
          }
          error={model.customerError}
          disabled={!model.fieldsEditable}
          onPress={model.openCustomerSheet}
        />
      </EditorSection>
      <EditorSection title={form.commentTitle}>
        <OrderFormCommentField
          control={model.control}
          copy={form}
          editable={model.fieldsEditable}
          error={model.commentError}
          onFieldEdit={model.onFieldEdit}
        />
      </EditorSection>
    </KeyboardAwareScrollView>
  );
}

function CenteredEmpty(props: { readonly children: ReactNode }) {
  return <View style={styles.centered}>{props.children}</View>;
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
    paddingBottom: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  footerDock: {
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  footerCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.card,
    ...theme.squircle,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  footerLines: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
    fontWeight: "500",
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
}));
