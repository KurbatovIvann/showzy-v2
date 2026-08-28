import { Controller, type Control } from "react-hook-form";

import type { CustomersFormCopy } from "../../../i18n/customers";
import { TextField } from "../../../components/ui";
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
    <Controller
      control={props.control}
      name="name"
      render={({ field }) => (
        <TextField
          label={props.copy.nameLabel}
          value={field.value}
          onChangeText={(value) => {
            field.onChange(value);
            props.onFieldEdit();
          }}
          placeholder={props.copy.namePlaceholder}
          accessibilityLabel={props.copy.nameLabel}
          keyboardType="default"
          autoCapitalize="words"
          autoCorrect
          autoComplete="off"
          maxLength={CUSTOMER_NAME_MAX}
          editable={props.editable}
          error={props.error}
          changed={customerFormFieldChanged(
            props.mode,
            field.value,
            props.originName,
          )}
          changedLabel={props.copy.changedLabel}
        />
      )}
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
    <Controller
      control={props.control}
      name="phone"
      render={({ field }) => (
        <TextField
          label={props.copy.phoneLabel}
          value={field.value}
          onChangeText={(value) => {
            field.onChange(value);
            props.onFieldEdit();
          }}
          placeholder={props.copy.phonePlaceholder}
          accessibilityLabel={props.copy.phoneLabel}
          keyboardType="phone-pad"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="tel"
          maxLength={CUSTOMER_PHONE_MAX}
          editable={props.editable}
          error={props.error}
          changed={customerFormFieldChanged(
            props.mode,
            field.value,
            props.originPhone,
          )}
          changedLabel={props.copy.changedLabel}
        />
      )}
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
    <Controller
      control={props.control}
      name="email"
      render={({ field }) => (
        <TextField
          label={props.copy.emailLabel}
          value={field.value}
          onChangeText={(value) => {
            field.onChange(value);
            props.onFieldEdit();
          }}
          placeholder={props.copy.emailPlaceholder}
          accessibilityLabel={props.copy.emailLabel}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          maxLength={CUSTOMER_EMAIL_MAX}
          editable={props.editable}
          error={props.error}
          changed={customerFormFieldChanged(
            props.mode,
            field.value,
            props.originEmail,
          )}
          changedLabel={props.copy.changedLabel}
        />
      )}
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
    <Controller
      control={props.control}
      name="notes"
      render={({ field }) => (
        <TextField
          label={props.copy.notesLabel}
          value={field.value}
          onChangeText={(value) => {
            field.onChange(value);
            props.onFieldEdit();
          }}
          placeholder={props.copy.notesPlaceholder}
          accessibilityLabel={props.copy.notesLabel}
          keyboardType="default"
          autoCapitalize="sentences"
          autoCorrect
          autoComplete="off"
          maxLength={CUSTOMER_NOTES_MAX}
          multiline
          numberOfLines={CUSTOMER_FORM_NOTES_LINES}
          editable={props.editable}
          error={props.error}
          changed={customerFormFieldChanged(
            props.mode,
            field.value,
            props.originNotes,
          )}
          changedLabel={props.copy.changedLabel}
        />
      )}
    />
  );
}
