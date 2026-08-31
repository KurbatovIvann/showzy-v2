import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { Banner, SegmentedTabs, StatusPill } from "../../../components/ui";
import { FormScreenScaffold } from "../../../components/form-kit";
import {
  CompanyLegalFormBankEdrpouField,
  CompanyLegalFormBankMfoField,
  CompanyLegalFormBankNameField,
  CompanyLegalFormEdrpouField,
  CompanyLegalFormEmailField,
  CompanyLegalFormIbanField,
  CompanyLegalFormLegalAddressField,
  CompanyLegalFormNameField,
  CompanyLegalFormPhoneField,
} from "./company-legal-form-fields";
import type { CompanyLegalFormModel } from "./use-company-legal-form";

export function CompanyLegalFormView(model: CompanyLegalFormModel) {
  const { copy } = model;
  const form = copy.legalForm;

  return (
    <FormScreenScaffold
      title={copy.legalLabel}
      accessibilityLabel={copy.legalLabel}
      backLabel={copy.backLabel}
      onBack={model.requestLeave}
      loadKind={model.state.kind}
      loadingLabel={form.loadingLabel}
      empty={{
        offlineTitle: copy.offlineTitle,
        offlineDescription: copy.offlineDescription,
        errorTitle: copy.errorTitle,
        errorDescription: copy.errorDescription,
        permissionTitle: copy.permissionTitle,
        permissionDescription: copy.permissionDescription,
        retryLabel: copy.retry,
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
      <CompanyLegalFormReady model={model} />
    </FormScreenScaffold>
  );
}

function CompanyLegalFormReady(props: {
  readonly model: CompanyLegalFormModel;
}) {
  const { model } = props;
  const { copy } = model;
  const form = copy.legalForm;
  const { theme } = useUnistyles();

  return (
    <KeyboardAwareScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      bottomOffset={theme.spacing.lg}
    >
      <CompanyLegalFormSection
        title={form.typeLabel}
        changed={model.companyTypeChanged}
        changedLabel={form.changedLabel}
      >
        <SegmentedTabs
          tabs={model.typeTabs}
          selected={model.companyType}
          onSelect={model.selectCompanyType}
          disabled={!model.fieldsEditable}
          layout="equal"
        />
      </CompanyLegalFormSection>
      <CompanyLegalFormSection title={form.companyTitle}>
        <CompanyLegalFormNameField
          control={model.control}
          copy={form}
          mode={model.mode}
          originLegalName={model.originLegalName}
          editable={model.fieldsEditable}
          error={model.legalNameError}
          onFieldEdit={model.onFieldEdit}
        />
        <CompanyLegalFormEdrpouField
          control={model.control}
          copy={form}
          mode={model.mode}
          originEdrpou={model.originEdrpou}
          editable={model.fieldsEditable}
          error={model.edrpouError}
          onFieldEdit={model.onFieldEdit}
        />
        <CompanyLegalFormLegalAddressField
          control={model.control}
          copy={form}
          mode={model.mode}
          originLegalAddress={model.originLegalAddress}
          editable={model.fieldsEditable}
          error={model.legalAddressError}
          onFieldEdit={model.onFieldEdit}
        />
      </CompanyLegalFormSection>
      <CompanyLegalFormSection title={form.bankTitle}>
        <CompanyLegalFormIbanField
          control={model.control}
          copy={form}
          mode={model.mode}
          originIban={model.originIban}
          editable={model.fieldsEditable}
          error={model.ibanError}
          onFieldEdit={model.onFieldEdit}
        />
        <CompanyLegalFormBankNameField
          control={model.control}
          copy={form}
          mode={model.mode}
          originBankName={model.originBankName}
          editable={model.fieldsEditable}
          error={model.bankNameError}
          onFieldEdit={model.onFieldEdit}
        />
        <CompanyLegalFormBankMfoField
          control={model.control}
          copy={form}
          mode={model.mode}
          originBankMfo={model.originBankMfo}
          editable={model.fieldsEditable}
          error={model.bankMfoError}
          onFieldEdit={model.onFieldEdit}
        />
        <CompanyLegalFormBankEdrpouField
          control={model.control}
          copy={form}
          mode={model.mode}
          originBankEdrpou={model.originBankEdrpou}
          editable={model.fieldsEditable}
          error={model.bankEdrpouError}
          onFieldEdit={model.onFieldEdit}
        />
      </CompanyLegalFormSection>
      <CompanyLegalFormSection title={form.contactsTitle}>
        <Text style={styles.hint}>{form.contactsHelper}</Text>
        <CompanyLegalFormPhoneField
          control={model.control}
          copy={form}
          mode={model.mode}
          originPhone={model.originPhone}
          editable={model.fieldsEditable}
          error={model.phoneError}
          onFieldEdit={model.onFieldEdit}
        />
        <CompanyLegalFormEmailField
          control={model.control}
          copy={form}
          mode={model.mode}
          originEmail={model.originEmail}
          editable={model.fieldsEditable}
          error={model.emailError}
          onFieldEdit={model.onFieldEdit}
        />
      </CompanyLegalFormSection>
      {model.banner !== null && model.banner.length > 0 ? (
        <Banner message={model.banner} />
      ) : null}
    </KeyboardAwareScrollView>
  );
}

function CompanyLegalFormSection(props: {
  readonly title: string;
  readonly children: ReactNode;
  readonly changed?: boolean;
  readonly changedLabel?: string;
}) {
  const showChanged =
    props.changed === true &&
    props.changedLabel !== undefined &&
    props.changedLabel.length > 0;
  return (
    <View style={styles.section}>
      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle}>{props.title}</Text>
        {showChanged ? (
          <StatusPill label={props.changedLabel ?? ""} tone="action" />
        ) : null}
      </View>
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
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
  },
  sectionTitle: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
    fontWeight: "600",
    flex: 1,
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
