import { Controller, type Control } from "react-hook-form";

import type { CustomersInviteFormCopy } from "../../../i18n/customers";
import { TextField } from "../../../components/ui";
import {
  CUSTOMER_EMAIL_MAX,
  CUSTOMER_NAME_MAX,
  CUSTOMER_PHONE_MAX,
} from "../shared/customer-caps";
import type { InvitationFormDraft } from "./invitation-form-draft";

export function InvitationFormNameField(props: {
  readonly control: Control<InvitationFormDraft>;
  readonly copy: CustomersInviteFormCopy;
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
        />
      )}
    />
  );
}

export function InvitationFormPhoneField(props: {
  readonly control: Control<InvitationFormDraft>;
  readonly copy: CustomersInviteFormCopy;
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
        />
      )}
    />
  );
}

export function InvitationFormEmailField(props: {
  readonly control: Control<InvitationFormDraft>;
  readonly copy: CustomersInviteFormCopy;
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
        />
      )}
    />
  );
}

export function InvitationFormMaxUsesField(props: {
  readonly control: Control<InvitationFormDraft>;
  readonly copy: CustomersInviteFormCopy;
  readonly editable: boolean;
  readonly error: string | null;
  readonly onFieldEdit: () => void;
}) {
  return (
    <Controller
      control={props.control}
      name="maxUses"
      render={({ field }) => (
        <TextField
          label={props.copy.maxUsesLabel}
          value={field.value}
          onChangeText={(value) => {
            field.onChange(value);
            props.onFieldEdit();
          }}
          placeholder={props.copy.maxUsesPlaceholder}
          accessibilityLabel={props.copy.maxUsesLabel}
          keyboardType="number-pad"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          editable={props.editable}
          error={props.error}
        />
      )}
    />
  );
}
