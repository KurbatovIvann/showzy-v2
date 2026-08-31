import { useCallback, type ReactNode } from "react";
import { Text, View, type ScrollViewProps } from "react-native";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import { PercentIcon, SearchIcon, TagsIcon } from "lucide-react-native";
import { Controller } from "react-hook-form";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { Banner, Button, SwitchRow, TextField } from "../../../components/ui";
import { FormScreenScaffold } from "../../../components/form-kit";
import { PriceEntryRow } from "./price-entry-row";
import { PriceListFormNameField } from "./price-list-form-fields";
import type { PresentedPriceEntry } from "./price-list-form.presenter";
import type { PriceListFormModel } from "./use-price-list-form";

export function PriceListFormView(model: PriceListFormModel) {
  const { copy } = model;
  const form = copy.form;
  const { theme } = useUnistyles();

  return (
    <FormScreenScaffold
      title={model.headerTitle}
      accessibilityLabel={model.headerTitle}
      backLabel={copy.backLabel}
      onBack={model.requestLeave}
      loadKind={model.state.kind}
      loadingLabel={form.loadingLabel}
      empty={{
        offlineTitle: copy.empty.offlineTitle,
        offlineDescription: copy.empty.offlineDescription,
        errorTitle: copy.empty.errorTitle,
        errorDescription: copy.empty.errorDescription,
        permissionTitle:
          model.mode === "create"
            ? form.permissionCreateTitle
            : form.permissionEditTitle,
        permissionDescription:
          model.mode === "create"
            ? form.permissionCreateDescription
            : form.permissionEditDescription,
        retryLabel: copy.empty.retry,
        notFoundTitle: form.notFoundTitle,
        notFoundDescription: form.notFoundDescription,
        notFoundIcon: (
          <TagsIcon
            size={theme.iconSize.md}
            color={theme.colors.mutedForeground}
          />
        ),
      }}
      onRetry={model.retry}
      {...(model.state.kind === "ready"
        ? {
            footer: {
              cancelLabel: form.cancel,
              submitLabel: model.submitLabel,
              pending: model.pending,
              submitDisabled: model.submitDisabled,
              onCancel: model.requestLeave,
              onSubmit: model.save,
            },
          }
        : {})}
    >
      <PriceListFormReady model={model} />
    </FormScreenScaffold>
  );
}

function PriceListFormReady(props: { readonly model: PriceListFormModel }) {
  const { model } = props;
  const { copy, onFieldEdit, toggleExpand } = model;
  const form = copy.form;
  const { theme } = useUnistyles();

  const renderItem: ListRenderItem<PresentedPriceEntry> = useCallback(
    ({ item }) => (
      <PriceEntryRow
        control={model.control}
        fieldIndex={item.fieldIndex}
        copy={form}
        mode={model.mode}
        name={item.name}
        archived={item.archived}
        kind={item.kind}
        basePriceMinor={item.basePriceMinor}
        originPriceText={item.originPriceText}
        editable={model.fieldsEditable}
        error={item.error}
        expanded={item.expanded}
        expanding={item.expanding}
        showExpand={item.showExpand}
        onFieldEdit={onFieldEdit}
        onToggleExpand={toggleExpand}
        productId={item.productId}
      />
    ),
    [
      form,
      model.control,
      model.fieldsEditable,
      model.mode,
      onFieldEdit,
      toggleExpand,
    ],
  );

  if (model.mode === "create") {
    return (
      <KeyboardAwareScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        bottomOffset={theme.spacing.lg}
      >
        <PriceListFormHeader model={model} />
        <Text style={styles.hint}>{form.createPricesHint}</Text>
        {model.banner !== null && model.banner.length > 0 ? (
          <Banner message={model.banner} />
        ) : null}
      </KeyboardAwareScrollView>
    );
  }

  return (
    <FlashList
      data={model.priceRows}
      style={styles.scroll}
      renderScrollComponent={PriceListEditorScroll}
      keyExtractor={priceEntryKeyExtractor}
      getItemType={priceEntryItemType}
      renderItem={renderItem}
      ItemSeparatorComponent={PriceRowSeparator}
      ListHeaderComponent={<PriceListFormHeader model={model} />}
      ListFooterComponent={
        model.banner !== null && model.banner.length > 0 ? (
          <Banner message={model.banner} />
        ) : null
      }
      extraData={model.fieldsEditable}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.listContent}
    />
  );
}

function PriceListFormHeader(props: { readonly model: PriceListFormModel }) {
  const { model } = props;
  const { copy } = model;
  const form = copy.form;
  const { theme } = useUnistyles();

  return (
    <View style={styles.header}>
      <PriceListFormSection title={form.aboutTitle}>
        <PriceListFormNameField
          control={model.control}
          copy={form}
          mode={model.mode}
          originName={model.originName}
          editable={model.fieldsEditable}
          error={model.nameError}
          onFieldEdit={model.onFieldEdit}
        />
        <Text style={styles.hint}>{form.emptyPriceHint}</Text>
      </PriceListFormSection>
      <PriceListFormSection title={form.statusTitle}>
        <Controller
          control={model.control}
          name="isDefault"
          render={({ field }) => (
            <SwitchRow
              label={form.defaultLabel}
              description={form.defaultDescription}
              checked={field.value}
              disabled={!model.fieldsEditable}
              onChange={model.onDefaultChange}
            />
          )}
        />
        <Controller
          control={model.control}
          name="isActive"
          render={({ field }) => (
            <SwitchRow
              label={field.value ? form.activeLabel : form.inactiveLabel}
              description={
                model.isDefault
                  ? form.defaultAlwaysActive
                  : field.value
                    ? form.activeDescriptionOn
                    : form.activeDescriptionOff
              }
              checked={field.value}
              disabled={!model.fieldsEditable}
              onChange={model.onActiveChange}
            />
          )}
        />
      </PriceListFormSection>
      {model.mode === "edit" ? (
        <PriceListFormSection title={form.pricesTitle}>
          <TextField
            value={model.productSearch}
            onChangeText={model.changeProductSearch}
            placeholder={form.productSearchPlaceholder}
            accessibilityLabel={form.productSearchLabel}
            keyboardType="default"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            maxLength={model.productSearchMaxLength}
            editable={model.fieldsEditable}
            leading={
              <SearchIcon
                size={theme.iconSize.sm}
                color={theme.colors.icon.muted}
              />
            }
          />
          <View style={styles.bulkRow}>
            <View style={styles.bulkField}>
              <TextField
                value={model.bulkPercent}
                onChangeText={model.changeBulkPercent}
                placeholder={form.bulkPlaceholder}
                accessibilityLabel={form.bulkLabel}
                keyboardType="decimal-pad"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                maxLength={3}
                editable={model.fieldsEditable}
                leading={
                  <PercentIcon
                    size={theme.iconSize.sm}
                    color={theme.colors.icon.muted}
                  />
                }
              />
            </View>
            <Button
              variant="secondary"
              label={form.bulkApply}
              disabled={
                !model.fieldsEditable || model.bulkPercent.trim().length === 0
              }
              onPress={model.applyBulk}
            />
          </View>
          {model.bulkNote !== null && model.bulkNote.length > 0 ? (
            <Text style={styles.hint}>{model.bulkNote}</Text>
          ) : null}
          {model.priceRows.length === 0 ? (
            <Text style={styles.emptyPrices}>{form.noProducts}</Text>
          ) : null}
        </PriceListFormSection>
      ) : null}
    </View>
  );
}

function PriceListEditorScroll(props: ScrollViewProps) {
  const { theme } = useUnistyles();
  return (
    <KeyboardAwareScrollView
      {...props}
      keyboardShouldPersistTaps="handled"
      bottomOffset={theme.spacing.lg}
    />
  );
}

function PriceListFormSection(props: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{props.title}</Text>
      <View style={styles.sectionCard}>{props.children}</View>
    </View>
  );
}

function priceEntryKeyExtractor(row: PresentedPriceEntry): string {
  return row.entryKey;
}

function priceEntryItemType(row: PresentedPriceEntry): string {
  return row.kind;
}

function PriceRowSeparator() {
  return <View style={styles.rowSeparator} />;
}

const styles = StyleSheet.create((theme) => ({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.xl,
  },
  listContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xl,
  },
  header: {
    gap: theme.spacing.xl,
    paddingBottom: theme.spacing.lg,
  },
  section: {
    gap: theme.spacing.sm,
  },
  sectionTitle: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
    fontWeight: "600",
    paddingHorizontal: theme.spacing.xs,
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
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
  },
  bulkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.sm,
  },
  bulkField: {
    flex: 1,
    minWidth: 0,
  },
  emptyPrices: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
    textAlign: "center",
    paddingVertical: theme.spacing.lg,
  },
  rowSeparator: {
    height: theme.spacing.sm,
  },
}));
