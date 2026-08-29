import { Controller, type Control } from "react-hook-form";

import type { CompaniesLegalFormCopy } from "../../../i18n/companies";
import { TextField } from "../../../components/ui";
import {
  COMPANY_LEGAL_ADDRESS_MAX,
  COMPANY_LEGAL_BANK_EDRPOU_MAX,
  COMPANY_LEGAL_BANK_MFO_MAX,
  COMPANY_LEGAL_BANK_NAME_MAX,
  COMPANY_LEGAL_EDRPOU_MAX,
  COMPANY_LEGAL_EMAIL_MAX,
  COMPANY_LEGAL_FORM_ADDRESS_LINES,
  COMPANY_LEGAL_IBAN_MAX,
  COMPANY_LEGAL_NAME_MAX,
  COMPANY_LEGAL_PHONE_MAX,
} from "../shared/company-caps";
import {
  companyLegalFormFieldChanged,
  type CompanyLegalFormDraft,
  type CompanyLegalFormMode,
} from "./company-legal-form-draft";

type DraftTextKey = Exclude<keyof CompanyLegalFormDraft, "companyType">;

function CompanyLegalDraftField(props: {
  readonly control: Control<CompanyLegalFormDraft>;
  readonly name: DraftTextKey;
  readonly copy: CompaniesLegalFormCopy;
  readonly label: string;
  readonly placeholder: string;
  readonly mode: CompanyLegalFormMode;
  readonly origin: string;
  readonly editable: boolean;
  readonly error: string | null;
  readonly onFieldEdit: () => void;
  readonly maxLength: number;
  readonly keyboardType?:
    "phone-pad" | "email-address" | "default" | "number-pad";
  readonly autoCapitalize?: "none" | "sentences" | "words" | "characters";
  readonly autoCorrect?: boolean;
  readonly autoComplete?: "email" | "tel" | "off" | "organization";
  readonly multiline?: boolean;
  readonly numberOfLines?: number;
}) {
  return (
    <Controller
      control={props.control}
      name={props.name}
      render={({ field }) => (
        <TextField
          label={props.label}
          value={field.value}
          onChangeText={(value) => {
            field.onChange(value);
            props.onFieldEdit();
          }}
          placeholder={props.placeholder}
          accessibilityLabel={props.label}
          keyboardType={props.keyboardType ?? "default"}
          autoCapitalize={props.autoCapitalize ?? "sentences"}
          autoCorrect={props.autoCorrect ?? true}
          autoComplete={props.autoComplete ?? "off"}
          maxLength={props.maxLength}
          multiline={props.multiline === true}
          {...(props.multiline === true && props.numberOfLines !== undefined
            ? { numberOfLines: props.numberOfLines }
            : {})}
          editable={props.editable}
          error={props.error}
          changed={companyLegalFormFieldChanged(
            props.mode,
            field.value,
            props.origin,
          )}
          changedLabel={props.copy.changedLabel}
        />
      )}
    />
  );
}

export function CompanyLegalFormNameField(props: {
  readonly control: Control<CompanyLegalFormDraft>;
  readonly copy: CompaniesLegalFormCopy;
  readonly mode: CompanyLegalFormMode;
  readonly originLegalName: string;
  readonly editable: boolean;
  readonly error: string | null;
  readonly onFieldEdit: () => void;
}) {
  return (
    <CompanyLegalDraftField
      control={props.control}
      name="legalName"
      copy={props.copy}
      label={props.copy.legalNameLabel}
      placeholder={props.copy.legalNamePlaceholder}
      mode={props.mode}
      origin={props.originLegalName}
      editable={props.editable}
      error={props.error}
      onFieldEdit={props.onFieldEdit}
      maxLength={COMPANY_LEGAL_NAME_MAX}
      autoCapitalize="words"
      autoComplete="organization"
    />
  );
}

export function CompanyLegalFormEdrpouField(props: {
  readonly control: Control<CompanyLegalFormDraft>;
  readonly copy: CompaniesLegalFormCopy;
  readonly mode: CompanyLegalFormMode;
  readonly originEdrpou: string;
  readonly editable: boolean;
  readonly error: string | null;
  readonly onFieldEdit: () => void;
}) {
  return (
    <CompanyLegalDraftField
      control={props.control}
      name="edrpou"
      copy={props.copy}
      label={props.copy.edrpouLabel}
      placeholder={props.copy.edrpouPlaceholder}
      mode={props.mode}
      origin={props.originEdrpou}
      editable={props.editable}
      error={props.error}
      onFieldEdit={props.onFieldEdit}
      maxLength={COMPANY_LEGAL_EDRPOU_MAX}
      keyboardType="number-pad"
      autoCapitalize="none"
      autoCorrect={false}
    />
  );
}

export function CompanyLegalFormLegalAddressField(props: {
  readonly control: Control<CompanyLegalFormDraft>;
  readonly copy: CompaniesLegalFormCopy;
  readonly mode: CompanyLegalFormMode;
  readonly originLegalAddress: string;
  readonly editable: boolean;
  readonly error: string | null;
  readonly onFieldEdit: () => void;
}) {
  return (
    <CompanyLegalDraftField
      control={props.control}
      name="legalAddress"
      copy={props.copy}
      label={props.copy.legalAddressLabel}
      placeholder={props.copy.legalAddressPlaceholder}
      mode={props.mode}
      origin={props.originLegalAddress}
      editable={props.editable}
      error={props.error}
      onFieldEdit={props.onFieldEdit}
      maxLength={COMPANY_LEGAL_ADDRESS_MAX}
      multiline
      numberOfLines={COMPANY_LEGAL_FORM_ADDRESS_LINES}
    />
  );
}

export function CompanyLegalFormIbanField(props: {
  readonly control: Control<CompanyLegalFormDraft>;
  readonly copy: CompaniesLegalFormCopy;
  readonly mode: CompanyLegalFormMode;
  readonly originIban: string;
  readonly editable: boolean;
  readonly error: string | null;
  readonly onFieldEdit: () => void;
}) {
  return (
    <CompanyLegalDraftField
      control={props.control}
      name="iban"
      copy={props.copy}
      label={props.copy.ibanLabel}
      placeholder={props.copy.ibanPlaceholder}
      mode={props.mode}
      origin={props.originIban}
      editable={props.editable}
      error={props.error}
      onFieldEdit={props.onFieldEdit}
      maxLength={COMPANY_LEGAL_IBAN_MAX}
      autoCapitalize="characters"
      autoCorrect={false}
    />
  );
}

export function CompanyLegalFormBankNameField(props: {
  readonly control: Control<CompanyLegalFormDraft>;
  readonly copy: CompaniesLegalFormCopy;
  readonly mode: CompanyLegalFormMode;
  readonly originBankName: string;
  readonly editable: boolean;
  readonly error: string | null;
  readonly onFieldEdit: () => void;
}) {
  return (
    <CompanyLegalDraftField
      control={props.control}
      name="bankName"
      copy={props.copy}
      label={props.copy.bankNameLabel}
      placeholder={props.copy.bankNamePlaceholder}
      mode={props.mode}
      origin={props.originBankName}
      editable={props.editable}
      error={props.error}
      onFieldEdit={props.onFieldEdit}
      maxLength={COMPANY_LEGAL_BANK_NAME_MAX}
      autoCapitalize="words"
    />
  );
}

export function CompanyLegalFormBankMfoField(props: {
  readonly control: Control<CompanyLegalFormDraft>;
  readonly copy: CompaniesLegalFormCopy;
  readonly mode: CompanyLegalFormMode;
  readonly originBankMfo: string;
  readonly editable: boolean;
  readonly error: string | null;
  readonly onFieldEdit: () => void;
}) {
  return (
    <CompanyLegalDraftField
      control={props.control}
      name="bankMfo"
      copy={props.copy}
      label={props.copy.bankMfoLabel}
      placeholder={props.copy.bankMfoPlaceholder}
      mode={props.mode}
      origin={props.originBankMfo}
      editable={props.editable}
      error={props.error}
      onFieldEdit={props.onFieldEdit}
      maxLength={COMPANY_LEGAL_BANK_MFO_MAX}
      keyboardType="number-pad"
      autoCapitalize="none"
      autoCorrect={false}
    />
  );
}

export function CompanyLegalFormBankEdrpouField(props: {
  readonly control: Control<CompanyLegalFormDraft>;
  readonly copy: CompaniesLegalFormCopy;
  readonly mode: CompanyLegalFormMode;
  readonly originBankEdrpou: string;
  readonly editable: boolean;
  readonly error: string | null;
  readonly onFieldEdit: () => void;
}) {
  return (
    <CompanyLegalDraftField
      control={props.control}
      name="bankEdrpou"
      copy={props.copy}
      label={props.copy.bankEdrpouLabel}
      placeholder={props.copy.bankEdrpouPlaceholder}
      mode={props.mode}
      origin={props.originBankEdrpou}
      editable={props.editable}
      error={props.error}
      onFieldEdit={props.onFieldEdit}
      maxLength={COMPANY_LEGAL_BANK_EDRPOU_MAX}
      keyboardType="number-pad"
      autoCapitalize="none"
      autoCorrect={false}
    />
  );
}

export function CompanyLegalFormPhoneField(props: {
  readonly control: Control<CompanyLegalFormDraft>;
  readonly copy: CompaniesLegalFormCopy;
  readonly mode: CompanyLegalFormMode;
  readonly originPhone: string;
  readonly editable: boolean;
  readonly error: string | null;
  readonly onFieldEdit: () => void;
}) {
  return (
    <CompanyLegalDraftField
      control={props.control}
      name="phone"
      copy={props.copy}
      label={props.copy.phoneLabel}
      placeholder={props.copy.phonePlaceholder}
      mode={props.mode}
      origin={props.originPhone}
      editable={props.editable}
      error={props.error}
      onFieldEdit={props.onFieldEdit}
      maxLength={COMPANY_LEGAL_PHONE_MAX}
      keyboardType="phone-pad"
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete="tel"
    />
  );
}

export function CompanyLegalFormEmailField(props: {
  readonly control: Control<CompanyLegalFormDraft>;
  readonly copy: CompaniesLegalFormCopy;
  readonly mode: CompanyLegalFormMode;
  readonly originEmail: string;
  readonly editable: boolean;
  readonly error: string | null;
  readonly onFieldEdit: () => void;
}) {
  return (
    <CompanyLegalDraftField
      control={props.control}
      name="email"
      copy={props.copy}
      label={props.copy.emailLabel}
      placeholder={props.copy.emailPlaceholder}
      mode={props.mode}
      origin={props.originEmail}
      editable={props.editable}
      error={props.error}
      onFieldEdit={props.onFieldEdit}
      maxLength={COMPANY_LEGAL_EMAIL_MAX}
      keyboardType="email-address"
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete="email"
    />
  );
}
