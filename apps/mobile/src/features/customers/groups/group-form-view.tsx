import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { LayersIcon, TagIcon } from "lucide-react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { FormScreenScaffold } from "../../../components/form-kit";
import { Banner, OptionSelectSheet, SelectorRow } from "../../../components/ui";
import { LIST_GROUPS_SEARCH_MAX } from "../shared/customer-caps";
import {
  GroupFormDescriptionField,
  GroupFormNameField,
} from "./group-form-fields";
import type { GroupFormModel } from "./use-group-form";

export function GroupFormView(model: GroupFormModel) {
  const { copy } = model;
  const form = copy.groupForm;
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
        notFoundIcon: <LayersIcon size={theme.iconSize.md} color={iconColor} />,
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
        <OptionSelectSheet
          visible={model.pickerOpen}
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
      }
    >
      <GroupFormReady model={model} />
    </FormScreenScaffold>
  );
}

function GroupFormReady(props: { readonly model: GroupFormModel }) {
  const { model } = props;
  const { copy } = model;
  const form = copy.groupForm;
  const { theme } = useUnistyles();
  const iconColor = theme.colors.mutedForeground;

  return (
    <KeyboardAwareScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      bottomOffset={theme.spacing.lg}
    >
      <GroupFormSection title={form.aboutTitle}>
        <GroupFormNameField
          control={model.control}
          copy={form}
          mode={model.mode}
          originName={model.originName}
          editable={model.fieldsEditable}
          error={model.nameError}
          onFieldEdit={model.onFieldEdit}
        />
        <GroupFormDescriptionField
          control={model.control}
          copy={form}
          mode={model.mode}
          originDescription={model.originDescription}
          editable={model.fieldsEditable}
          error={model.descriptionError}
          onFieldEdit={model.onFieldEdit}
        />
        {model.memberHint !== null ? (
          <Text style={styles.hint}>{model.memberHint}</Text>
        ) : null}
      </GroupFormSection>
      <GroupFormSection title={form.termsTitle}>
        <SelectorRow
          label={form.priceListLabel}
          value={model.priceListValue}
          placeholder={form.priceListPlaceholder}
          icon={<TagIcon size={theme.iconSize.sm} color={iconColor} />}
          changed={model.priceListChanged}
          changedLabel={form.changedLabel}
          disabled={!model.fieldsEditable}
          onPress={model.openPriceListPicker}
        />
      </GroupFormSection>
      {model.banner !== null && model.banner.length > 0 ? (
        <Banner message={model.banner} />
      ) : null}
    </KeyboardAwareScrollView>
  );
}

function GroupFormSection(props: {
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
}));
