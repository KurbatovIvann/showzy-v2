/**
 * Customers copy namespace (uk/en). Role files live in `./customers/`.
 * Public exports stay on this module so feature imports do not change.
 */
import { selectCopy } from "./copy";
import type { Locale } from "./locale";
import {
  en as enClientForm,
  uk as ukClientForm,
  type CustomersFormCopy,
} from "./customers/client-form";
import {
  en as enCounterpartyForm,
  uk as ukCounterpartyForm,
  type CustomersCounterpartyFormCopy,
} from "./customers/counterparty-form";
import {
  en as enGroupForm,
  uk as ukGroupForm,
  type CustomersGroupFormCopy,
} from "./customers/group-form";
import {
  en as enInviteForm,
  uk as ukInviteForm,
  type CustomersInviteFormCopy,
} from "./customers/invite-form";
import {
  en as enList,
  uk as ukList,
  type CustomersListCopy,
} from "./customers/list";

export type {
  CustomersConfirmCopy,
  CustomersCountForms,
  CustomersEditorStubCopy,
  CustomersEmptyCopy,
  CustomersInviteStatusCopy,
  CustomersListCopy,
  CustomersMutationCopy,
} from "./customers/list";
export type { CustomersFormCopy } from "./customers/client-form";
export type { CustomersGroupFormCopy } from "./customers/group-form";
export type { CustomersCounterpartyFormCopy } from "./customers/counterparty-form";
export type { CustomersInviteFormCopy } from "./customers/invite-form";

export type CustomersCopy = CustomersListCopy & {
  readonly form: CustomersFormCopy;
  readonly groupForm: CustomersGroupFormCopy;
  readonly counterpartyForm: CustomersCounterpartyFormCopy;
  readonly inviteForm: CustomersInviteFormCopy;
};

export function customersCopy(locale: Locale): CustomersCopy {
  return selectCopy(locale, {
    uk: {
      ...ukList,
      form: ukClientForm,
      groupForm: ukGroupForm,
      counterpartyForm: ukCounterpartyForm,
      inviteForm: ukInviteForm,
    },
    en: {
      ...enList,
      form: enClientForm,
      groupForm: enGroupForm,
      counterpartyForm: enCounterpartyForm,
      inviteForm: enInviteForm,
    },
  });
}
