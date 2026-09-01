/**
 * Customer-form view-model assembly (SHO-307). Composer glue (Query,
 * RHF, save, leave) stays in `use-customer-form.ts`.
 */
import { describeQueryFailure, describeWireError } from "../../../api/errors";
import type { CustomersCopy } from "../../../i18n/customers";
import { interpolate } from "../../../i18n/locale";
import type { OptionSelectItem } from "../shared/option-select";
import { selectorLookupValue } from "../shared/option-select";
import {
  fieldErrorsFromFormState,
  mapCustomerFormFailure,
  mapValidationIssues,
  resolveCustomerFormCopy,
} from "./customer-form-copy";
import {
  customerFormFieldChanged,
  type CustomerFormDraft,
  type CustomerFormMode,
} from "./customer-form-draft";
import type { CustomerFormLoadState } from "./customer-form-load";
import {
  counterpartiesBodyCopy,
  counterpartiesBodyKind,
  groupAssignedPriceListId,
  inheritedPriceListPlaceholder,
  type CounterpartiesBodyKind,
} from "./customer-form-pickers";
import type { CustomerFormWrite } from "./customer-form-plan";
import type { LinkedCounterpartyRow } from "./use-customer-linked-counterparties";

export type CustomerFormPicker = "group" | "priceList" | null;

export type PresentedLinkedCounterparty = {
  readonly id: string;
  readonly name: string;
  readonly edrpouLabel: string;
};

export function presentCustomerFormCopy(args: {
  readonly formCopy: CustomersCopy["form"];
  readonly mode: CustomerFormMode;
  readonly submitted: boolean;
  readonly nameMessage: unknown;
  readonly phoneMessage: unknown;
  readonly emailMessage: unknown;
  readonly notesMessage: unknown;
  readonly mutationError: unknown;
  readonly lastWrite: CustomerFormWrite | null;
  readonly isMutationError: boolean;
  readonly pending: boolean;
  readonly clientReady: boolean;
}): ReturnType<typeof resolveCustomerFormCopy> {
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
    phoneMessage: args.phoneMessage,
    emailMessage: args.emailMessage,
    notesMessage: args.notesMessage,
    server: serverFields,
  });
  return resolveCustomerFormCopy(args.formCopy, {
    mode: args.mode,
    nameError: fieldErrors.name,
    phoneError: fieldErrors.phone,
    emailError: fieldErrors.email,
    notesError: fieldErrors.notes,
    contactError: fieldErrors.contact,
    banner: mapCustomerFormFailure(failure?.kind ?? null, wire?.code ?? null),
    pending: args.pending,
    clientReady: args.clientReady,
  });
}

export function presentLinkedCounterparties(args: {
  readonly items: readonly LinkedCounterpartyRow[];
  readonly emptyEdrpou: string;
  readonly edrpouBadge: string;
}): readonly PresentedLinkedCounterparty[] {
  return args.items.map((item) => ({
    id: item.id,
    name: item.name,
    edrpouLabel:
      item.edrpou != null && item.edrpou.length > 0
        ? interpolate(args.edrpouBadge, { edrpou: item.edrpou })
        : args.emptyEdrpou,
  }));
}

export function presentCustomerFormView(args: {
  readonly copy: CustomersCopy;
  readonly mode: CustomerFormMode;
  readonly origin: CustomerFormDraft;
  readonly loadState: CustomerFormLoadState;
  readonly resolved: ReturnType<typeof resolveCustomerFormCopy>;
  readonly pending: boolean;
  readonly isDirty: boolean;
  readonly picker: CustomerFormPicker;
  readonly groupId: string | null;
  readonly priceListId: string | null;
  readonly lookups: {
    readonly groupNameById: ReadonlyMap<string, string>;
    readonly priceListNameById: ReadonlyMap<string, string>;
    readonly priceListIdByGroupId: ReadonlyMap<string, string | null>;
    readonly groupOptions: readonly OptionSelectItem[];
    readonly priceListOptions: readonly OptionSelectItem[];
  };
  readonly archived: boolean;
  readonly canWrite: boolean;
  readonly canDelete: boolean;
  readonly counterpartiesStatus: "idle" | "pending" | "error" | "success";
  readonly linkedItems: readonly LinkedCounterpartyRow[];
  readonly lifecycleBanner: string | null;
}): {
  readonly originName: string;
  readonly originPhone: string;
  readonly originEmail: string;
  readonly originNotes: string;
  readonly state: CustomerFormLoadState;
  readonly nameError: string | null;
  readonly phoneError: string | null;
  readonly emailError: string | null;
  readonly notesError: string | null;
  readonly banner: string | null;
  readonly pending: boolean;
  readonly submitDisabled: boolean;
  readonly submitLabel: string;
  readonly fieldsEditable: boolean;
  readonly headerTitle: string;
  readonly picker: CustomerFormPicker;
  readonly groupId: string | null;
  readonly priceListId: string | null;
  readonly groupValue: string | undefined;
  readonly priceListValue: string | undefined;
  readonly priceListPlaceholder: string;
  readonly groupChanged: boolean;
  readonly priceListChanged: boolean;
  readonly groupOptions: readonly OptionSelectItem[];
  readonly priceListOptions: readonly OptionSelectItem[];
  readonly archived: boolean;
  readonly archivedLabel: string;
  readonly showArchive: boolean;
  readonly showRestore: boolean;
  readonly showDelete: boolean;
  readonly counterpartiesKind: CounterpartiesBodyKind;
  readonly counterpartiesBodyText: string | null;
  readonly linkedCounterparties: readonly PresentedLinkedCounterparty[];
} {
  const formCopy = args.copy.form;
  const counterpartiesKind = counterpartiesBodyKind({
    mode: args.mode,
    status: args.counterpartiesStatus,
    itemCount: args.linkedItems.length,
  });
  const groupPriceListId = groupAssignedPriceListId(
    args.groupId,
    args.lookups.priceListIdByGroupId,
  );
  return {
    originName: args.origin.name,
    originPhone: args.origin.phone,
    originEmail: args.origin.email,
    originNotes: args.origin.notes,
    state: args.loadState,
    nameError: args.resolved.nameError,
    phoneError: args.resolved.phoneError ?? args.resolved.contactError,
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
        ? args.copy.editorStub.clientCreateTitle
        : args.copy.editorStub.clientEditTitle,
    picker: args.picker,
    groupId: args.groupId,
    priceListId: args.priceListId,
    groupValue: selectorLookupValue(
      args.groupId,
      args.lookups.groupNameById,
      formCopy.assignmentUnavailable,
    ),
    priceListValue: selectorLookupValue(
      args.priceListId,
      args.lookups.priceListNameById,
      formCopy.assignmentUnavailable,
    ),
    priceListPlaceholder: inheritedPriceListPlaceholder({
      groupPriceListId,
      inheritGroup: formCopy.priceListInheritGroup,
      retailDefault: formCopy.priceListDefault,
    }),
    groupChanged: customerFormFieldChanged(
      args.mode,
      args.groupId,
      args.origin.groupId,
    ),
    priceListChanged: customerFormFieldChanged(
      args.mode,
      args.priceListId,
      args.origin.priceListId,
    ),
    groupOptions: args.lookups.groupOptions,
    priceListOptions: args.lookups.priceListOptions,
    archived: args.archived,
    archivedLabel: args.copy.archivedBadge,
    showArchive: args.mode === "edit" && !args.archived && args.canWrite,
    showRestore: args.mode === "edit" && args.archived && args.canWrite,
    showDelete: args.mode === "edit" && args.archived && args.canDelete,
    counterpartiesKind,
    counterpartiesBodyText: counterpartiesBodyCopy({
      kind: counterpartiesKind,
      createHint: formCopy.counterpartiesCreateHint,
      empty: formCopy.counterpartiesEmpty,
      error: args.copy.empty.errorDescription,
    }),
    linkedCounterparties: presentLinkedCounterparties({
      items: args.linkedItems,
      emptyEdrpou: formCopy.counterpartiesEdrpouEmpty,
      edrpouBadge: args.copy.edrpouBadge,
    }),
  };
}
