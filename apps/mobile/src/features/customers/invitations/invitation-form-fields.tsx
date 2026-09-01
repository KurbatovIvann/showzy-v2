import type { Control } from "react-hook-form";

import type { CustomersInviteFormCopy } from "../../../i18n/customers";
import { FormTextField } from "../../../components/form-kit";
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
    <FormTextField
      control={props.control}
      name="name"
      label={props.copy.nameLabel}
      placeholder={props.copy.namePlaceholder}
      error={props.error}
      editable={props.editable}
      onFieldEdit={props.onFieldEdit}
      maxLength={CUSTOMER_NAME_MAX}
      autoCapitalize="words"
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
    <FormTextField
      control={props.control}
      name="phone"
      label={props.copy.phoneLabel}
      placeholder={props.copy.phonePlaceholder}
      error={props.error}
      editable={props.editable}
      onFieldEdit={props.onFieldEdit}
      maxLength={CUSTOMER_PHONE_MAX}
      keyboardType="phone-pad"
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete="tel"
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
    <FormTextField
      control={props.control}
      name="email"
      label={props.copy.emailLabel}
      placeholder={props.copy.emailPlaceholder}
      error={props.error}
      editable={props.editable}
      onFieldEdit={props.onFieldEdit}
      maxLength={CUSTOMER_EMAIL_MAX}
      keyboardType="email-address"
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete="email"
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
    <FormTextField
      control={props.control}
      name="maxUses"
      label={props.copy.maxUsesLabel}
      placeholder={props.copy.maxUsesPlaceholder}
      error={props.error}
      editable={props.editable}
      onFieldEdit={props.onFieldEdit}
      keyboardType="number-pad"
      autoCapitalize="none"
      autoCorrect={false}
    />
  );
}
