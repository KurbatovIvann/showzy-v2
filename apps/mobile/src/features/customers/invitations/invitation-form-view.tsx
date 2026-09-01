import { useMemo, type ReactNode } from "react";
import { Platform, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  CalendarIcon,
  LayersIcon,
  LinkIcon,
  TagIcon,
} from "lucide-react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { FormScreenScaffold } from "../../../components/form-kit";
import {
  Banner,
  Button,
  OptionSelectSheet,
  SegmentedTabs,
  SelectorRow,
  Sheet,
} from "../../../components/ui";
import { LIST_GROUPS_SEARCH_MAX } from "../shared/customer-caps";
import {
  InvitationFormEmailField,
  InvitationFormMaxUsesField,
  InvitationFormNameField,
  InvitationFormPhoneField,
} from "./invitation-form-fields";
import {
  INVITE_EXPIRES_MAX_MS,
  INVITE_EXPIRES_MIN_MS,
} from "./invitation-form.schema";
import type { InvitationFormModel } from "./use-invitation-form";

export function InvitationFormView(model: InvitationFormModel) {
  const { copy } = model;
  const form = copy.inviteForm;
  const created = model.created !== null;
  const showSubmitFooter = model.state.kind === "ready" && !created;

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
        permissionTitle: form.permissionCreateTitle,
        permissionDescription: form.permissionCreateDescription,
        retryLabel: copy.empty.retry,
      }}
      {...(showSubmitFooter
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
          {model.state.kind === "ready" && created ? (
            <View style={styles.createdFooter}>
              <Button
                fullWidth
                label={form.done}
                onPress={model.requestLeave}
              />
            </View>
          ) : null}
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
          <InvitationExpiresPicker model={model} />
        </>
      }
    >
      <InvitationFormReady model={model} />
    </FormScreenScaffold>
  );
}

function InvitationFormReady(props: { readonly model: InvitationFormModel }) {
  const { model } = props;
  if (model.created !== null) {
    return <InvitationCreated model={model} />;
  }
  return <InvitationFormFields model={model} />;
}

function InvitationFormFields(props: { readonly model: InvitationFormModel }) {
  const { model } = props;
  const { copy } = model;
  const form = copy.inviteForm;
  const { theme } = useUnistyles();
  const iconColor = theme.colors.mutedForeground;

  return (
    <KeyboardAwareScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      bottomOffset={theme.spacing.lg}
    >
      <InvitationFormSection title={form.whoTitle}>
        <SegmentedTabs
          tabs={model.kindTabs}
          selected={model.kind}
          onSelect={model.selectKind}
          disabled={!model.fieldsEditable}
        />
        <Text style={styles.hint}>{form.whoHelper}</Text>
        <InvitationFormNameField
          control={model.control}
          copy={form}
          editable={model.fieldsEditable}
          error={model.nameError}
          onFieldEdit={model.onFieldEdit}
        />
        <InvitationFormPhoneField
          control={model.control}
          copy={form}
          editable={model.fieldsEditable}
          error={model.phoneError}
          onFieldEdit={model.onFieldEdit}
        />
        <InvitationFormEmailField
          control={model.control}
          copy={form}
          editable={model.fieldsEditable}
          error={model.emailError}
          onFieldEdit={model.onFieldEdit}
        />
      </InvitationFormSection>
      <InvitationFormSection title={form.termsTitle}>
        <SelectorRow
          label={form.groupLabel}
          value={model.groupValue}
          placeholder={form.groupPlaceholder}
          icon={<LayersIcon size={theme.iconSize.sm} color={iconColor} />}
          disabled={!model.fieldsEditable}
          onPress={model.openGroupPicker}
        />
        <SelectorRow
          label={form.priceListLabel}
          value={model.priceListValue}
          placeholder={model.priceListPlaceholder}
          icon={<TagIcon size={theme.iconSize.sm} color={iconColor} />}
          disabled={!model.fieldsEditable}
          onPress={model.openPriceListPicker}
        />
      </InvitationFormSection>
      <InvitationFormSection title={form.accessTitle}>
        {model.kind === "reusable" ? (
          <>
            <InvitationFormMaxUsesField
              control={model.control}
              copy={form}
              editable={model.fieldsEditable}
              error={model.maxUsesError}
              onFieldEdit={model.onFieldEdit}
            />
            <Text style={styles.hint}>{form.maxUsesHelper}</Text>
          </>
        ) : null}
        <SelectorRow
          label={form.expiresLabel}
          value={model.expiresValue}
          placeholder={form.expiresLabel}
          icon={<CalendarIcon size={theme.iconSize.sm} color={iconColor} />}
          error={model.expiresAtError}
          disabled={!model.fieldsEditable}
          onPress={model.openExpiresPicker}
        />
      </InvitationFormSection>
      {model.banner !== null && model.banner.length > 0 ? (
        <Banner message={model.banner} />
      ) : null}
    </KeyboardAwareScrollView>
  );
}

function InvitationCreated(props: { readonly model: InvitationFormModel }) {
  const { model } = props;
  const form = model.copy.inviteForm;
  const { theme } = useUnistyles();
  const iconColor = theme.colors.mutedForeground;
  const secret = model.created;
  if (secret === null) {
    return null;
  }

  return (
    <KeyboardAwareScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      bottomOffset={theme.spacing.lg}
    >
      <InvitationFormSection title={form.createdTitle}>
        <Text style={styles.hint}>{form.createdHelper}</Text>
        <View>
          <Text style={styles.secretLabel}>{form.urlLabel}</Text>
          <Text selectable style={styles.secretValue}>
            {secret.url}
          </Text>
        </View>
        <Button
          variant="secondary"
          fullWidth
          icon={<LinkIcon size={theme.iconSize.sm} color={iconColor} />}
          label={model.copied === "url" ? form.copied : form.copyUrl}
          onPress={model.copyUrl}
        />
        <View>
          <Text style={styles.secretLabel}>{form.tokenLabel}</Text>
          <Text selectable style={styles.secretValue}>
            {secret.token}
          </Text>
        </View>
        <Button
          variant="secondary"
          fullWidth
          label={model.copied === "token" ? form.copied : form.copyToken}
          onPress={model.copyToken}
        />
        {model.copyFailed !== null ? (
          <Banner message={model.copyFailed} />
        ) : null}
      </InvitationFormSection>
    </KeyboardAwareScrollView>
  );
}

function InvitationExpiresPicker(props: {
  readonly model: InvitationFormModel;
}) {
  const { model } = props;
  const form = model.copy.inviteForm;
  const visible = model.picker === "expires";
  const ios = Platform.OS === "ios";
  const { minimumDate, maximumDate } = useMemo(() => {
    const now = Date.now();
    return {
      minimumDate: new Date(now + INVITE_EXPIRES_MIN_MS),
      maximumDate: new Date(now + INVITE_EXPIRES_MAX_MS),
    };
  }, []);
  const value = new Date(model.expiresAt);
  const pickerValue = Number.isFinite(value.getTime()) ? value : minimumDate;

  const picker = visible ? (
    <DateTimePicker
      value={pickerValue}
      mode="date"
      display={ios ? "spinner" : "default"}
      minimumDate={minimumDate}
      maximumDate={maximumDate}
      onValueChange={(_event, date) => {
        model.selectExpiresDate(date);
        if (!ios) {
          model.closePicker();
        }
      }}
      onDismiss={() => {
        model.closePicker();
      }}
    />
  ) : null;

  if (!ios) {
    return picker;
  }

  return (
    <Sheet
      visible={visible}
      title={form.expiresSheetTitle}
      onClose={model.closePicker}
      mode="content"
      closeAccessibilityLabel={form.closeSheet}
    >
      {picker}
    </Sheet>
  );
}

function InvitationFormSection(props: {
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
  secretLabel: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
    fontWeight: "500",
    marginBottom: theme.spacing.xs,
  },
  secretValue: {
    color: theme.colors.foreground,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
  },
  createdFooter: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
}));
