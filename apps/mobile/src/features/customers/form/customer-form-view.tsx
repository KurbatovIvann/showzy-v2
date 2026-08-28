import type { ReactNode } from "react";
import { Text, View } from "react-native";
import {
  ArchiveIcon,
  LayersIcon,
  LockIcon,
  RotateCcwIcon,
  TagIcon,
  Trash2Icon,
  UserXIcon,
  WifiOffIcon,
} from "lucide-react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import {
  AppHeader,
  Banner,
  Button,
  EmptyState,
  StatusPill,
} from "../../../components/ui";
import { OptionSelectSheet } from "../shared/option-select-sheet";
import { SelectorRow } from "../shared/selector-row";
import {
  CustomerFormEmailField,
  CustomerFormNameField,
  CustomerFormNotesField,
  CustomerFormPhoneField,
} from "./customer-form-fields";
import type { CustomerFormModel } from "./use-customer-form";

export function CustomerFormView(model: CustomerFormModel) {
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
      <CustomerFormBody model={model} />
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
      <OptionSelectSheet
        visible={model.picker === "group"}
        title={form.groupSheetTitle}
        emptyOptionLabel={form.groupEmptyOption}
        searchPlaceholder={form.groupSearchPlaceholder}
        searchLabel={copy.searchLabel}
        closeLabel={form.closeSheet}
        value={model.groupId}
        options={model.groupOptions}
        onClose={model.closePicker}
        onChange={model.selectGroup}
      />
      <OptionSelectSheet
        visible={model.picker === "priceList"}
        title={form.priceListSheetTitle}
        emptyOptionLabel={form.priceListEmptyOption}
        searchPlaceholder={form.priceListSearchPlaceholder}
        searchLabel={copy.searchLabel}
        closeLabel={form.closeSheet}
        value={model.priceListId}
        options={model.priceListOptions}
        onClose={model.closePicker}
        onChange={model.selectPriceList}
      />
    </SafeAreaView>
  );
}

function CustomerFormBody(props: { readonly model: CustomerFormModel }) {
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
          <View style={[styles.skeletonLine, styles.skeletonPrice]} />
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
            icon={<UserXIcon size={theme.iconSize.md} color={iconColor} />}
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
      return <CustomerFormReady model={model} />;
  }
}

function CustomerFormReady(props: { readonly model: CustomerFormModel }) {
  const { model } = props;
  const { copy } = model;
  const form = copy.form;
  const { theme } = useUnistyles();
  const iconColor = theme.colors.mutedForeground;

  return (
    <KeyboardAwareScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      bottomOffset={theme.spacing.lg}
    >
      {model.archived ? (
        <StatusPill label={model.archivedLabel} tone="attention" />
      ) : null}
      <CustomerFormSection title={form.contactsTitle}>
        <Text style={styles.hint}>{form.contactsHelper}</Text>
        <CustomerFormNameField
          control={model.control}
          copy={form}
          mode={model.mode}
          originName={model.originName}
          editable={model.fieldsEditable}
          error={model.nameError}
          onFieldEdit={model.onFieldEdit}
        />
        <CustomerFormPhoneField
          control={model.control}
          copy={form}
          mode={model.mode}
          originPhone={model.originPhone}
          editable={model.fieldsEditable}
          error={model.phoneError}
          onFieldEdit={model.onFieldEdit}
        />
        <CustomerFormEmailField
          control={model.control}
          copy={form}
          mode={model.mode}
          originEmail={model.originEmail}
          editable={model.fieldsEditable}
          error={model.emailError}
          onFieldEdit={model.onFieldEdit}
        />
      </CustomerFormSection>
      <CustomerFormSection title={form.termsTitle}>
        <SelectorRow
          label={form.groupLabel}
          value={model.groupValue}
          placeholder={form.groupPlaceholder}
          icon={<LayersIcon size={theme.iconSize.sm} color={iconColor} />}
          changed={model.groupChanged}
          changedLabel={form.changedLabel}
          disabled={!model.fieldsEditable}
          onPress={model.openGroupPicker}
        />
        <SelectorRow
          label={form.priceListLabel}
          value={model.priceListValue}
          placeholder={model.priceListPlaceholder}
          icon={<TagIcon size={theme.iconSize.sm} color={iconColor} />}
          changed={model.priceListChanged}
          changedLabel={form.changedLabel}
          disabled={!model.fieldsEditable}
          onPress={model.openPriceListPicker}
        />
      </CustomerFormSection>
      <CustomerFormSection title={form.counterpartiesTitle}>
        <Text style={styles.hint}>{form.counterpartiesHelper}</Text>
        {model.counterpartiesBodyText !== null ? (
          <Text
            style={
              model.counterpartiesKind === "count" ? styles.count : styles.hint
            }
          >
            {model.counterpartiesBodyText}
          </Text>
        ) : null}
      </CustomerFormSection>
      <CustomerFormSection title={form.notesTitle}>
        <CustomerFormNotesField
          control={model.control}
          copy={form}
          mode={model.mode}
          originNotes={model.originNotes}
          editable={model.fieldsEditable}
          error={model.notesError}
          onFieldEdit={model.onFieldEdit}
        />
      </CustomerFormSection>
      {model.mode === "edit" &&
      (model.showArchive || model.showRestore || model.showDelete) ? (
        <CustomerFormSection title={form.archiveTitle}>
          <Text style={styles.hint}>
            {model.archived
              ? form.archiveArchivedHelper
              : form.archiveActiveHelper}
          </Text>
          {model.showArchive ? (
            <Button
              variant="secondary"
              fullWidth
              label={form.archiveAction}
              disabled={model.pending}
              icon={
                <ArchiveIcon
                  size={theme.iconSize.sm}
                  color={theme.colors.foreground}
                />
              }
              onPress={() => {
                void model.archive();
              }}
            />
          ) : null}
          {model.showRestore ? (
            <Button
              variant="secondary"
              fullWidth
              label={form.restoreAction}
              disabled={model.pending}
              icon={
                <RotateCcwIcon
                  size={theme.iconSize.sm}
                  color={theme.colors.foreground}
                />
              }
              onPress={() => {
                void model.restore();
              }}
            />
          ) : null}
          {model.showDelete ? (
            <Button
              variant="danger"
              fullWidth
              label={form.deleteAction}
              disabled={model.pending}
              icon={
                <Trash2Icon
                  size={theme.iconSize.sm}
                  color={theme.colors.destructive}
                />
              }
              onPress={() => {
                void model.remove();
              }}
            />
          ) : null}
        </CustomerFormSection>
      ) : null}
      {model.banner !== null && model.banner.length > 0 ? (
        <Banner message={model.banner} />
      ) : null}
    </KeyboardAwareScrollView>
  );
}

function CustomerFormSection(props: {
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
  count: {
    color: theme.colors.foreground,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
    fontWeight: "500",
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
