import type { ReactNode } from "react";
import { Text, View } from "react-native";
import {
  BuildingIcon,
  LockIcon,
  Trash2Icon,
  UserIcon,
  WifiOffIcon,
} from "lucide-react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { AppHeader, Banner, Button, EmptyState } from "../../../components/ui";
import { OptionSelectSheet } from "../shared/option-select-sheet";
import { SelectorRow } from "../shared/selector-row";
import {
  CounterpartyFormBankMfoField,
  CounterpartyFormBankNameField,
  CounterpartyFormEdrpouField,
  CounterpartyFormEmailField,
  CounterpartyFormIbanField,
  CounterpartyFormLegalAddressField,
  CounterpartyFormNameField,
  CounterpartyFormNotesField,
  CounterpartyFormPhoneField,
} from "./counterparty-form-fields";
import type { CounterpartyFormModel } from "./use-counterparty-form";

export function CounterpartyFormView(model: CounterpartyFormModel) {
  const { copy } = model;
  const form = copy.counterpartyForm;

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
      <CounterpartyFormBody model={model} />
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
        visible={model.pickerOpen}
        title={form.customerSheetTitle}
        emptyOptionLabel={form.customerEmptyOption}
        searchPlaceholder={form.customerSearchPlaceholder}
        searchLabel={copy.searchLabel}
        closeLabel={form.closeSheet}
        value={model.customerId}
        options={model.customerOptions}
        onClose={model.closePicker}
        onChange={model.selectCustomer}
      />
    </SafeAreaView>
  );
}

function CounterpartyFormBody(props: {
  readonly model: CounterpartyFormModel;
}) {
  const { model } = props;
  const { copy } = model;
  const { theme } = useUnistyles();
  const iconColor = theme.colors.mutedForeground;
  const form = copy.counterpartyForm;

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
            icon={<BuildingIcon size={theme.iconSize.md} color={iconColor} />}
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
      return <CounterpartyFormReady model={model} />;
  }
}

function CounterpartyFormReady(props: {
  readonly model: CounterpartyFormModel;
}) {
  const { model } = props;
  const { copy } = model;
  const form = copy.counterpartyForm;
  const { theme } = useUnistyles();
  const iconColor = theme.colors.mutedForeground;

  return (
    <KeyboardAwareScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      bottomOffset={theme.spacing.lg}
    >
      <CounterpartyFormSection title={form.customerTitle}>
        <Text style={styles.hint}>{form.customerHelper}</Text>
        <SelectorRow
          label={form.customerLabel}
          value={model.customerValue}
          placeholder={form.customerPlaceholder}
          icon={<UserIcon size={theme.iconSize.sm} color={iconColor} />}
          changed={model.customerChanged}
          changedLabel={form.changedLabel}
          disabled={!model.fieldsEditable}
          onPress={model.openCustomerPicker}
        />
        {model.showOpenClient ? (
          <Button
            variant="secondary"
            fullWidth
            label={form.openClient}
            disabled={model.pending}
            onPress={model.openClient}
          />
        ) : null}
      </CounterpartyFormSection>
      <CounterpartyFormSection title={form.requisitesTitle}>
        <CounterpartyFormNameField
          control={model.control}
          copy={form}
          mode={model.mode}
          originName={model.originName}
          editable={model.fieldsEditable}
          error={model.nameError}
          onFieldEdit={model.onFieldEdit}
        />
        <CounterpartyFormEdrpouField
          control={model.control}
          copy={form}
          mode={model.mode}
          originEdrpou={model.originEdrpou}
          editable={model.fieldsEditable}
          error={model.edrpouError}
          onFieldEdit={model.onFieldEdit}
        />
        <CounterpartyFormLegalAddressField
          control={model.control}
          copy={form}
          mode={model.mode}
          originLegalAddress={model.originLegalAddress}
          editable={model.fieldsEditable}
          error={model.legalAddressError}
          onFieldEdit={model.onFieldEdit}
        />
      </CounterpartyFormSection>
      <CounterpartyFormSection title={form.bankTitle}>
        <CounterpartyFormIbanField
          control={model.control}
          copy={form}
          mode={model.mode}
          originIban={model.originIban}
          editable={model.fieldsEditable}
          error={model.ibanError}
          onFieldEdit={model.onFieldEdit}
        />
        <CounterpartyFormBankNameField
          control={model.control}
          copy={form}
          mode={model.mode}
          originBankName={model.originBankName}
          editable={model.fieldsEditable}
          error={model.bankNameError}
          onFieldEdit={model.onFieldEdit}
        />
        <CounterpartyFormBankMfoField
          control={model.control}
          copy={form}
          mode={model.mode}
          originBankMfo={model.originBankMfo}
          editable={model.fieldsEditable}
          error={model.bankMfoError}
          onFieldEdit={model.onFieldEdit}
        />
      </CounterpartyFormSection>
      <CounterpartyFormSection title={form.contactsTitle}>
        <CounterpartyFormPhoneField
          control={model.control}
          copy={form}
          mode={model.mode}
          originPhone={model.originPhone}
          editable={model.fieldsEditable}
          error={model.phoneError}
          onFieldEdit={model.onFieldEdit}
        />
        <CounterpartyFormEmailField
          control={model.control}
          copy={form}
          mode={model.mode}
          originEmail={model.originEmail}
          editable={model.fieldsEditable}
          error={model.emailError}
          onFieldEdit={model.onFieldEdit}
        />
        <CounterpartyFormNotesField
          control={model.control}
          copy={form}
          mode={model.mode}
          originNotes={model.originNotes}
          editable={model.fieldsEditable}
          error={model.notesError}
          onFieldEdit={model.onFieldEdit}
        />
      </CounterpartyFormSection>
      {model.showDelete ? (
        <CounterpartyFormSection title={form.deleteTitle}>
          <Text style={styles.hint}>{form.deleteHelper}</Text>
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
        </CounterpartyFormSection>
      ) : null}
      {model.banner !== null && model.banner.length > 0 ? (
        <Banner message={model.banner} />
      ) : null}
    </KeyboardAwareScrollView>
  );
}

function CounterpartyFormSection(props: {
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
