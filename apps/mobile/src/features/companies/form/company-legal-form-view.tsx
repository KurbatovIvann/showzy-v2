import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { LockIcon, WifiOffIcon } from "lucide-react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import {
  AppHeader,
  Banner,
  Button,
  EmptyState,
  SegmentedTabs,
  StatusPill,
} from "../../../components/ui";
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
    <SafeAreaView
      edges={["top", "bottom"]}
      accessibilityLabel={copy.legalLabel}
      style={styles.screen}
    >
      <AppHeader
        title={copy.legalLabel}
        back={{
          onPress: model.requestLeave,
          accessibilityLabel: copy.backLabel,
        }}
      />
      <CompanyLegalFormBody model={model} />
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

function CompanyLegalFormBody(props: {
  readonly model: CompanyLegalFormModel;
}) {
  const { model } = props;
  const { copy } = model;
  const { theme } = useUnistyles();
  const iconColor = theme.colors.mutedForeground;
  const form = copy.legalForm;

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
            title={copy.offlineTitle}
            description={copy.offlineDescription}
            action={
              <Button
                variant="secondary"
                label={copy.retry}
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
            title={copy.errorTitle}
            description={copy.errorDescription}
            action={
              <Button
                variant="secondary"
                label={copy.retry}
                onPress={model.retry}
              />
            }
          />
        </CenteredEmpty>
      );
    case "permission":
      return (
        <CenteredEmpty>
          <EmptyState
            icon={<LockIcon size={theme.iconSize.md} color={iconColor} />}
            title={copy.permissionTitle}
            description={copy.permissionDescription}
          />
        </CenteredEmpty>
      );
    case "ready":
      return <CompanyLegalFormReady model={model} />;
  }
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
