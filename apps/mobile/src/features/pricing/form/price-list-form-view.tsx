import type { ReactNode } from "react";
import { Text, View } from "react-native";
import {
  LockIcon,
  PercentIcon,
  SearchIcon,
  TagsIcon,
  WifiOffIcon,
} from "lucide-react-native";
import { Controller } from "react-hook-form";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import {
  AppHeader,
  Banner,
  Button,
  EmptyState,
  SwitchRow,
  TextField,
} from "../../../components/ui";
import { PriceEntryRow } from "./price-entry-row";
import { PriceListFormNameField } from "./price-list-form-fields";
import type { PriceListFormModel } from "./use-price-list-form";

export function PriceListFormView(model: PriceListFormModel) {
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
      <PriceListFormBody model={model} />
      {model.state.kind === "ready" ? (
        <View style={styles.footer}>
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
      ) : null}
    </SafeAreaView>
  );
}

function PriceListFormBody(props: { readonly model: PriceListFormModel }) {
  const { model } = props;
  const { copy } = model;
  const { theme } = useUnistyles();
  const iconColor = theme.colors.mutedForeground;
  const form = copy.form;

  switch (model.state.kind) {
    case "loading":
      return (
        <View style={styles.skeletons} accessibilityLabel={form.loadingLabel}>
          <View style={[styles.skeletonLine, styles.skeletonName]} />
          <View style={styles.skeletonCard} />
        </View>
      );
    case "offline":
      return (
        <CenteredEmpty>
          <EmptyState
            icon={<WifiOffIcon size={theme.iconSize.md} color={iconColor} />}
            title={copy.empty.offlineTitle}
            description={copy.empty.offlineDescription}
            action={
              <Button
                variant="secondary"
                label={copy.empty.retry}
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
            title={copy.empty.errorTitle}
            description={copy.empty.errorDescription}
            action={
              model.mode === "edit" ? (
                <Button
                  variant="secondary"
                  label={copy.empty.retry}
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
            icon={<TagsIcon size={theme.iconSize.md} color={iconColor} />}
            title={form.notFoundTitle}
            description={form.notFoundDescription}
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
      return <PriceListFormReady model={model} />;
  }
}

function PriceListFormReady(props: { readonly model: PriceListFormModel }) {
  const { model } = props;
  const { copy } = model;
  const form = copy.form;
  const { theme } = useUnistyles();

  return (
    <KeyboardAwareScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      bottomOffset={theme.spacing.lg}
    >
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
              onChange={(checked) => {
                model.onDefaultChange(checked);
              }}
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
              onChange={(checked) => {
                model.onActiveChange(checked);
              }}
            />
          )}
        />
      </PriceListFormSection>
      {model.mode === "create" ? (
        <Text style={styles.hint}>{form.createPricesHint}</Text>
      ) : (
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
          ) : (
            <View style={styles.priceList}>
              {model.priceRows.map((row) => (
                <PriceEntryRow
                  key={row.entryKey}
                  control={model.control}
                  fieldIndex={row.fieldIndex}
                  copy={form}
                  mode={model.mode}
                  name={row.name}
                  archived={row.archived}
                  kind={row.kind}
                  basePriceMinor={row.basePriceMinor}
                  originPriceText={model.originPriceText(row.entryKey)}
                  editable={model.fieldsEditable}
                  error={model.entryError(row.entryKey)}
                  expanded={row.expanded}
                  expanding={row.expanding}
                  showExpand={row.showExpand}
                  onFieldEdit={model.onFieldEdit}
                  onToggleExpand={model.toggleExpand}
                  productId={row.productId}
                />
              ))}
            </View>
          )}
        </PriceListFormSection>
      )}
      {model.banner !== null && model.banner.length > 0 ? (
        <Banner message={model.banner} />
      ) : null}
    </KeyboardAwareScrollView>
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
  priceList: {
    gap: theme.spacing.sm,
  },
  emptyPrices: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
    textAlign: "center",
    paddingVertical: theme.spacing.lg,
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
  skeletonCard: {
    height: theme.hitTarget.row,
    borderRadius: theme.radii.xl,
    ...theme.squircle,
    backgroundColor: theme.colors.skeleton,
  },
}));
