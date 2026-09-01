import type { ReactNode } from "react";
import { Text, View } from "react-native";
import {
  ArchiveIcon,
  BuildingIcon,
  LayersIcon,
  PlusIcon,
  RotateCcwIcon,
  TagIcon,
  Trash2Icon,
  UserXIcon,
} from "lucide-react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { FormScreenScaffold } from "../../../components/form-kit";
import {
  Banner,
  Button,
  OptionSelectSheet,
  SelectorRow,
  StatusPill,
} from "../../../components/ui";
import { LIST_GROUPS_SEARCH_MAX } from "../shared/customer-caps";
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
  const { theme } = useUnistyles();
  const iconColor = theme.colors.mutedForeground;
  const retryEdit =
    model.state.kind === "offline" ||
    (model.state.kind === "error" && model.mode === "edit");

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
        notFoundIcon: <UserXIcon size={theme.iconSize.md} color={iconColor} />,
      }}
      {...(retryEdit ? { onRetry: model.retry } : {})}
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
      overlay={
        <>
          <OptionSelectSheet
            visible={model.picker === "group"}
            title={form.groupSheetTitle}
            emptyOptionLabel={form.groupEmptyOption}
            emptyLabel={form.groupEmpty}
            searchPlaceholder={form.groupSearchPlaceholder}
            searchLabel={copy.searchLabel}
            closeLabel={form.closeSheet}
            value={model.groupId}
            options={model.groupOptions}
            searchMaxLength={LIST_GROUPS_SEARCH_MAX}
            onClose={model.closePicker}
            onChange={model.selectGroup}
          />
          <OptionSelectSheet
            visible={model.picker === "priceList"}
            title={form.priceListSheetTitle}
            emptyOptionLabel={form.priceListEmptyOption}
            emptyLabel={form.priceListEmpty}
            searchPlaceholder={form.priceListSearchPlaceholder}
            searchLabel={copy.searchLabel}
            closeLabel={form.closeSheet}
            value={model.priceListId}
            options={model.priceListOptions}
            searchMaxLength={LIST_GROUPS_SEARCH_MAX}
            onClose={model.closePicker}
            onChange={model.selectPriceList}
          />
        </>
      }
    >
      <CustomerFormReady model={model} />
    </FormScreenScaffold>
  );
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
        {model.counterpartiesKind === "loading" ? (
          <View
            style={[styles.skeletonLine, styles.skeletonPrice]}
            accessibilityLabel={form.loadingLabel}
          />
        ) : null}
        {model.counterpartiesBodyText !== null ? (
          <Text style={styles.hint}>{model.counterpartiesBodyText}</Text>
        ) : null}
        {model.counterpartiesKind === "error" ? (
          <Button
            variant="secondary"
            fullWidth
            label={copy.empty.retry}
            disabled={model.pending}
            onPress={model.retryCounterparties}
          />
        ) : null}
        {model.counterpartiesKind === "list"
          ? model.linkedCounterparties.map((item) => (
              <SelectorRow
                key={item.id}
                label={item.name}
                value={item.edrpouLabel}
                placeholder={form.counterpartiesEdrpouEmpty}
                icon={
                  <BuildingIcon size={theme.iconSize.sm} color={iconColor} />
                }
                disabled={model.pending}
                onPress={() => {
                  model.openCounterparty(item.id);
                }}
              />
            ))
          : null}
        {model.mode === "edit" ? (
          <Button
            variant="secondary"
            fullWidth
            label={form.counterpartiesAdd}
            disabled={!model.fieldsEditable || model.pending}
            icon={
              <PlusIcon
                size={theme.iconSize.sm}
                color={theme.colors.foreground}
              />
            }
            onPress={model.addCounterparty}
          />
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
  skeletonLine: {
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.skeleton,
  },
  skeletonPrice: {
    height: theme.hitTarget.field,
    width: "60%",
  },
}));
