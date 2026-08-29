import type { ReactNode } from "react";
import { Platform, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  CalendarIcon,
  LayersIcon,
  LinkIcon,
  LockIcon,
  TagIcon,
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
  SegmentedTabs,
  Sheet,
} from "../../../components/ui";
import { OptionSelectSheet } from "../shared/option-select-sheet";
import { SelectorRow } from "../shared/selector-row";
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
      <InvitationFormBody model={model} />
      {model.state.kind === "ready" ? (
        <View style={styles.footer}>
          {model.created !== null ? (
            <Button fullWidth label={form.done} onPress={model.requestLeave} />
          ) : (
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
          )}
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
      <InvitationExpiresPicker model={model} />
    </SafeAreaView>
  );
}

function InvitationFormBody(props: { readonly model: InvitationFormModel }) {
  const { model } = props;
  const { copy } = model;
  const { theme } = useUnistyles();
  const iconColor = theme.colors.mutedForeground;
  const form = copy.inviteForm;

  switch (model.state.kind) {
    case "error":
      return (
        <CenteredEmpty>
          <EmptyState
            icon={<WifiOffIcon size={theme.iconSize.md} color={iconColor} />}
            title={copy.empty.errorTitle}
            description={copy.empty.errorDescription}
          />
        </CenteredEmpty>
      );
    case "permission":
      return (
        <CenteredEmpty>
          <EmptyState
            icon={<LockIcon size={theme.iconSize.md} color={iconColor} />}
            title={form.permissionCreateTitle}
            description={form.permissionCreateDescription}
          />
        </CenteredEmpty>
      );
    case "ready":
      return <InvitationFormReady model={model} />;
  }
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
  const now = Date.now();
  const minimumDate = new Date(now + INVITE_EXPIRES_MIN_MS);
  const maximumDate = new Date(now + INVITE_EXPIRES_MAX_MS);
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
      footer={null}
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
}));
