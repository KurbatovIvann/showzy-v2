/**
 * Counterparty-form view-model assembly (SHO-307). Composer glue stays
 * in `use-counterparty-form.ts`.
 */
import { describeQueryFailure, describeWireError } from "../../../api/errors";
import type { CustomersCopy } from "../../../i18n/customers";
import type { OptionSelectItem } from "../shared/option-select";
import { selectorLookupValue } from "../shared/option-select";
import {
  fieldErrorsFromFormState,
  mapCounterpartyFormFailure,
  mapValidationIssues,
  resolveCounterpartyFormCopy,
} from "./counterparty-form-copy";
import {
  counterpartyFormFieldChanged,
  type CounterpartyFormDraft,
  type CounterpartyFormMode,
} from "./counterparty-form-draft";
import type { CounterpartyFormLoadState } from "./counterparty-form-load";
import {
  ensureLinkedCustomerOption,
  linkedCustomerName,
} from "./counterparty-form-options";
import type { CounterpartyFormWrite } from "./counterparty-form-plan";

export function presentCounterpartyFormCopy(args: {
  readonly formCopy: CustomersCopy["counterpartyForm"];
  readonly mode: CounterpartyFormMode;
  readonly submitted: boolean;
  readonly nameMessage: unknown;
  readonly edrpouMessage: unknown;
  readonly legalAddressMessage: unknown;
  readonly ibanMessage: unknown;
  readonly bankNameMessage: unknown;
  readonly bankMfoMessage: unknown;
  readonly phoneMessage: unknown;
  readonly emailMessage: unknown;
  readonly notesMessage: unknown;
  readonly mutationError: unknown;
  readonly lastWrite: CounterpartyFormWrite | null;
  readonly isMutationError: boolean;
  readonly pending: boolean;
  readonly clientReady: boolean;
}): ReturnType<typeof resolveCounterpartyFormCopy> {
  const failure = args.isMutationError
    ? describeQueryFailure(args.mutationError)
    : null;
  const wire = args.isMutationError
    ? describeWireError(args.mutationError)
    : null;
  const serverFields = args.isMutationError
    ? mapValidationIssues(args.mutationError, args.lastWrite)
    : null;
  const fieldErrors = fieldErrorsFromFormState({
    submitted: args.submitted,
    nameMessage: args.nameMessage,
    edrpouMessage: args.edrpouMessage,
    legalAddressMessage: args.legalAddressMessage,
    ibanMessage: args.ibanMessage,
    bankNameMessage: args.bankNameMessage,
    bankMfoMessage: args.bankMfoMessage,
    phoneMessage: args.phoneMessage,
    emailMessage: args.emailMessage,
    notesMessage: args.notesMessage,
    server: serverFields,
  });
  return resolveCounterpartyFormCopy(args.formCopy, {
    mode: args.mode,
    nameError: fieldErrors.name,
    edrpouError: fieldErrors.edrpou,
    legalAddressError: fieldErrors.legalAddress,
    ibanError: fieldErrors.iban,
    bankNameError: fieldErrors.bankName,
    bankMfoError: fieldErrors.bankMfo,
    phoneError: fieldErrors.phone,
    emailError: fieldErrors.email,
    notesError: fieldErrors.notes,
    banner: mapCounterpartyFormFailure(
      failure?.kind ?? null,
      wire?.code ?? null,
    ),
    pending: args.pending,
    clientReady: args.clientReady,
  });
}

export function presentCounterpartyFormView(args: {
  readonly copy: CustomersCopy;
  readonly mode: CounterpartyFormMode;
  readonly origin: CounterpartyFormDraft;
  readonly loadState: CounterpartyFormLoadState;
  readonly resolved: ReturnType<typeof resolveCounterpartyFormCopy>;
  readonly pending: boolean;
  readonly isDirty: boolean;
  readonly pickerOpen: boolean;
  readonly customerId: string | null;
  readonly canWrite: boolean;
  readonly lookups: {
    readonly customerOptions: readonly OptionSelectItem[];
    readonly customerNameById: ReadonlyMap<string, string>;
    readonly prefillCustomerName: string | null;
  };
  readonly counterpartyCustomerName: string | null | undefined;
  readonly lifecycleBanner: string | null;
}): {
  readonly originName: string;
  readonly originEdrpou: string;
  readonly originLegalAddress: string;
  readonly originIban: string;
  readonly originBankName: string;
  readonly originBankMfo: string;
  readonly originPhone: string;
  readonly originEmail: string;
  readonly originNotes: string;
  readonly state: CounterpartyFormLoadState;
  readonly nameError: string | null;
  readonly edrpouError: string | null;
  readonly legalAddressError: string | null;
  readonly ibanError: string | null;
  readonly bankNameError: string | null;
  readonly bankMfoError: string | null;
  readonly phoneError: string | null;
  readonly emailError: string | null;
  readonly notesError: string | null;
  readonly banner: string | null;
  readonly pending: boolean;
  readonly submitDisabled: boolean;
  readonly submitLabel: string;
  readonly fieldsEditable: boolean;
  readonly headerTitle: string;
  readonly pickerOpen: boolean;
  readonly customerId: string | null;
  readonly customerValue: string | undefined;
  readonly customerChanged: boolean;
  readonly customerOptions: readonly OptionSelectItem[];
  readonly showOpenClient: boolean;
  readonly showDelete: boolean;
} {
  const formCopy = args.copy.counterpartyForm;
  const linkedName = linkedCustomerName({
    fromCounterparty: args.counterpartyCustomerName,
    fromPrefillCustomer: args.lookups.prefillCustomerName,
  });
  const customerOptions = ensureLinkedCustomerOption({
    options: args.lookups.customerOptions,
    customerId: args.customerId,
    customerName: linkedName,
    unnamedFallback: formCopy.assignmentUnavailable,
  });
  return {
    originName: args.origin.name,
    originEdrpou: args.origin.edrpou,
    originLegalAddress: args.origin.legalAddress,
    originIban: args.origin.iban,
    originBankName: args.origin.bankName,
    originBankMfo: args.origin.bankMfo,
    originPhone: args.origin.phone,
    originEmail: args.origin.email,
    originNotes: args.origin.notes,
    state: args.loadState,
    nameError: args.resolved.nameError,
    edrpouError: args.resolved.edrpouError,
    legalAddressError: args.resolved.legalAddressError,
    ibanError: args.resolved.ibanError,
    bankNameError: args.resolved.bankNameError,
    bankMfoError: args.resolved.bankMfoError,
    phoneError: args.resolved.phoneError,
    emailError: args.resolved.emailError,
    notesError: args.resolved.notesError,
    banner: args.lifecycleBanner ?? args.resolved.banner,
    pending: args.pending,
    submitDisabled:
      args.resolved.submitDisabled ||
      args.loadState.kind !== "ready" ||
      (args.mode === "edit" && !args.isDirty),
    submitLabel: args.resolved.submitLabel,
    fieldsEditable:
      args.resolved.fieldsEditable && args.loadState.kind === "ready",
    headerTitle:
      args.mode === "create"
        ? args.copy.editorStub.counterpartyCreateTitle
        : args.copy.editorStub.counterpartyEditTitle,
    pickerOpen: args.pickerOpen,
    customerId: args.customerId,
    customerValue: selectorLookupValue(
      args.customerId,
      args.lookups.customerNameById,
      linkedName ?? formCopy.assignmentUnavailable,
    ),
    customerChanged: counterpartyFormFieldChanged(
      args.mode,
      args.customerId,
      args.origin.customerId,
    ),
    customerOptions,
    showOpenClient: args.customerId !== null,
    showDelete: args.mode === "edit" && args.canWrite,
  };
}
