import type { Control } from "react-hook-form";

import type { CustomersFormCopy } from "../../../i18n/customers";
import { FormTextField } from "../../../components/form-kit";
import {
  CUSTOMER_EMAIL_MAX,
  CUSTOMER_FORM_NOTES_LINES,
  CUSTOMER_NAME_MAX,
  CUSTOMER_NOTES_MAX,
  CUSTOMER_PHONE_MAX,
} from "../shared/customer-caps";
import {
  customerFormFieldChanged,
  type CustomerFormDraft,
  type CustomerFormMode,
} from "./customer-form-draft";

type DraftTextKey = keyof CustomerFormDraft;

function CustomerDraftField(props: {
  readonly control: Control<CustomerFormDraft>;
  readonly name: DraftTextKey;
  readonly copy: CustomersFormCopy;
  readonly label: string;
  readonly placeholder: string;
  readonly mode: CustomerFormMode;
  readonly origin: string;
  readonly editable: boolean;
  readonly error: string | null;
  readonly onFieldEdit: () => void;
  readonly maxLength: number;
  readonly keyboardType?: "phone-pad" | "email-address" | "default";
  readonly autoCapitalize?: "none" | "sentences" | "words";
  readonly autoCorrect?: boolean;
  readonly autoComplete?: "email" | "tel" | "off";
  readonly multiline?: boolean;
  readonly numberOfLines?: number;
}) {
  return (
    <FormTextField
      control={props.control}
      name={props.name}
      label={props.label}
      placeholder={props.placeholder}
      error={props.error}
      editable={props.editable}
      onFieldEdit={props.onFieldEdit}
      changed={(value) =>
        customerFormFieldChanged(props.mode, value, props.origin)
      }
      changedLabel={props.copy.changedLabel}
      maxLength={props.maxLength}
      {...(props.keyboardType !== undefined
        ? { keyboardType: props.keyboardType }
        : {})}
      {...(props.autoCapitalize !== undefined
        ? { autoCapitalize: props.autoCapitalize }
        : {})}
      {...(props.autoCorrect !== undefined
        ? { autoCorrect: props.autoCorrect }
        : {})}
      {...(props.autoComplete !== undefined
        ? { autoComplete: props.autoComplete }
        : {})}
      {...(props.multiline === true ? { multiline: true } : {})}
      {...(props.numberOfLines !== undefined
        ? { numberOfLines: props.numberOfLines }
        : {})}
    />
  );
}

export function CustomerFormNameField(props: {
  readonly control: Control<CustomerFormDraft>;
  readonly copy: CustomersFormCopy;
  readonly mode: CustomerFormMode;
  readonly originName: string;
  readonly editable: boolean;
  readonly error: string | null;
  readonly onFieldEdit: () => void;
}) {
  return (
    <CustomerDraftField
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
      maxLength={CUSTOMER_NAME_MAX}
      autoCapitalize="words"
    />
  );
}

export function CustomerFormPhoneField(props: {
  readonly control: Control<CustomerFormDraft>;
  readonly copy: CustomersFormCopy;
  readonly mode: CustomerFormMode;
  readonly originPhone: string;
  readonly editable: boolean;
  readonly error: string | null;
  readonly onFieldEdit: () => void;
}) {
  return (
    <CustomerDraftField
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
      maxLength={CUSTOMER_PHONE_MAX}
      keyboardType="phone-pad"
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete="tel"
    />
  );
}

export function CustomerFormEmailField(props: {
  readonly control: Control<CustomerFormDraft>;
  readonly copy: CustomersFormCopy;
  readonly mode: CustomerFormMode;
  readonly originEmail: string;
  readonly editable: boolean;
  readonly error: string | null;
  readonly onFieldEdit: () => void;
}) {
  return (
    <CustomerDraftField
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
      maxLength={CUSTOMER_EMAIL_MAX}
      keyboardType="email-address"
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete="email"
    />
  );
}

export function CustomerFormNotesField(props: {
  readonly control: Control<CustomerFormDraft>;
  readonly copy: CustomersFormCopy;
  readonly mode: CustomerFormMode;
  readonly originNotes: string;
  readonly editable: boolean;
  readonly error: string | null;
  readonly onFieldEdit: () => void;
}) {
  return (
    <CustomerDraftField
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
      maxLength={CUSTOMER_NOTES_MAX}
      autoCapitalize="sentences"
      multiline
      numberOfLines={CUSTOMER_FORM_NOTES_LINES}
    />
  );
}
