import { Controller, type Control } from "react-hook-form";

import type { CustomersCounterpartyFormCopy } from "../../../i18n/customers";
import { TextField } from "../../../components/ui";
import {
  COUNTERPARTY_BANK_MFO_MAX,
  COUNTERPARTY_BANK_NAME_MAX,
  COUNTERPARTY_EDRPOU_MAX,
  COUNTERPARTY_EMAIL_MAX,
  COUNTERPARTY_FORM_ADDRESS_LINES,
  COUNTERPARTY_FORM_NOTES_LINES,
  COUNTERPARTY_IBAN_MAX,
  COUNTERPARTY_LEGAL_ADDRESS_MAX,
  COUNTERPARTY_NAME_MAX,
  COUNTERPARTY_NOTES_MAX,
  COUNTERPARTY_PHONE_MAX,
} from "../shared/customer-caps";
import {
  counterpartyFormFieldChanged,
  type CounterpartyFormDraft,
  type CounterpartyFormMode,
} from "./counterparty-form-draft";

type DraftTextKey = Exclude<keyof CounterpartyFormDraft, "customerId">;

function CounterpartyDraftField(props: {
  readonly control: Control<CounterpartyFormDraft>;
  readonly name: DraftTextKey;
  readonly copy: CustomersCounterpartyFormCopy;
  readonly label: string;
  readonly placeholder: string;
  readonly mode: CounterpartyFormMode;
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
          changed={counterpartyFormFieldChanged(
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

export function CounterpartyFormNameField(props: {
  readonly control: Control<CounterpartyFormDraft>;
  readonly copy: CustomersCounterpartyFormCopy;
  readonly mode: CounterpartyFormMode;
  readonly originName: string;
  readonly editable: boolean;
  readonly error: string | null;
  readonly onFieldEdit: () => void;
}) {
  return (
    <CounterpartyDraftField
      control={props.control}
      name="name"
      copy={props.copy}
      label={props.copy.nameLabel}
      placeholder={props.copy.namePlaceholder}
      mode={props.mode}
      origin={props.originName}
      editable={props.editable}
      error={props.error}
      onFieldEdit={props.onFieldEdit}
      maxLength={COUNTERPARTY_NAME_MAX}
      autoCapitalize="words"
    />
  );
}

export function CounterpartyFormEdrpouField(props: {
  readonly control: Control<CounterpartyFormDraft>;
  readonly copy: CustomersCounterpartyFormCopy;
  readonly mode: CounterpartyFormMode;
  readonly originEdrpou: string;
  readonly editable: boolean;
  readonly error: string | null;
  readonly onFieldEdit: () => void;
}) {
  return (
    <CounterpartyDraftField
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
      maxLength={COUNTERPARTY_EDRPOU_MAX}
      keyboardType="number-pad"
      autoCapitalize="none"
      autoCorrect={false}
    />
  );
}

export function CounterpartyFormLegalAddressField(props: {
  readonly control: Control<CounterpartyFormDraft>;
  readonly copy: CustomersCounterpartyFormCopy;
  readonly mode: CounterpartyFormMode;
  readonly originLegalAddress: string;
  readonly editable: boolean;
  readonly error: string | null;
  readonly onFieldEdit: () => void;
}) {
  return (
    <CounterpartyDraftField
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
      maxLength={COUNTERPARTY_LEGAL_ADDRESS_MAX}
      multiline
      numberOfLines={COUNTERPARTY_FORM_ADDRESS_LINES}
    />
  );
}

export function CounterpartyFormIbanField(props: {
  readonly control: Control<CounterpartyFormDraft>;
  readonly copy: CustomersCounterpartyFormCopy;
  readonly mode: CounterpartyFormMode;
  readonly originIban: string;
  readonly editable: boolean;
  readonly error: string | null;
  readonly onFieldEdit: () => void;
}) {
  return (
    <CounterpartyDraftField
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
      maxLength={COUNTERPARTY_IBAN_MAX}
      autoCapitalize="characters"
      autoCorrect={false}
    />
  );
}

export function CounterpartyFormBankNameField(props: {
  readonly control: Control<CounterpartyFormDraft>;
  readonly copy: CustomersCounterpartyFormCopy;
  readonly mode: CounterpartyFormMode;
  readonly originBankName: string;
  readonly editable: boolean;
  readonly error: string | null;
  readonly onFieldEdit: () => void;
}) {
  return (
    <CounterpartyDraftField
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
      maxLength={COUNTERPARTY_BANK_NAME_MAX}
      autoCapitalize="words"
    />
  );
}

export function CounterpartyFormBankMfoField(props: {
  readonly control: Control<CounterpartyFormDraft>;
  readonly copy: CustomersCounterpartyFormCopy;
  readonly mode: CounterpartyFormMode;
  readonly originBankMfo: string;
  readonly editable: boolean;
  readonly error: string | null;
  readonly onFieldEdit: () => void;
}) {
  return (
    <CounterpartyDraftField
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
      maxLength={COUNTERPARTY_BANK_MFO_MAX}
      keyboardType="number-pad"
      autoCapitalize="none"
      autoCorrect={false}
    />
  );
}

export function CounterpartyFormPhoneField(props: {
  readonly control: Control<CounterpartyFormDraft>;
  readonly copy: CustomersCounterpartyFormCopy;
  readonly mode: CounterpartyFormMode;
  readonly originPhone: string;
  readonly editable: boolean;
  readonly error: string | null;
  readonly onFieldEdit: () => void;
}) {
  return (
    <CounterpartyDraftField
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
      maxLength={COUNTERPARTY_PHONE_MAX}
      keyboardType="phone-pad"
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete="tel"
    />
  );
}

export function CounterpartyFormEmailField(props: {
  readonly control: Control<CounterpartyFormDraft>;
  readonly copy: CustomersCounterpartyFormCopy;
  readonly mode: CounterpartyFormMode;
  readonly originEmail: string;
  readonly editable: boolean;
  readonly error: string | null;
  readonly onFieldEdit: () => void;
}) {
  return (
    <CounterpartyDraftField
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
      maxLength={COUNTERPARTY_EMAIL_MAX}
      keyboardType="email-address"
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete="email"
    />
  );
}

export function CounterpartyFormNotesField(props: {
  readonly control: Control<CounterpartyFormDraft>;
  readonly copy: CustomersCounterpartyFormCopy;
  readonly mode: CounterpartyFormMode;
  readonly originNotes: string;
  readonly editable: boolean;
  readonly error: string | null;
  readonly onFieldEdit: () => void;
}) {
  return (
    <CounterpartyDraftField
      control={props.control}
      name="notes"
      copy={props.copy}
      label={props.copy.notesLabel}
      placeholder={props.copy.notesPlaceholder}
      mode={props.mode}
      origin={props.originNotes}
      editable={props.editable}
      error={props.error}
      onFieldEdit={props.onFieldEdit}
      maxLength={COUNTERPARTY_NOTES_MAX}
      autoCapitalize="sentences"
      multiline
      numberOfLines={COUNTERPARTY_FORM_NOTES_LINES}
    />
  );
}
