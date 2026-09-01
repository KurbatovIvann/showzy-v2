/**
 * Document-form view-model assembly (SHO-306). Composer glue (RHF,
 * save, leave, handover) stays in `use-document-form.ts`.
 */
import { describeQueryFailure, describeWireError } from "../../../api/errors";
import type { DocumentsCopy } from "../../../i18n/documents";
import { documentsCreateScreenActions } from "../shared/document-permissions";
import {
  fieldErrorsFromFormState,
  mapDocumentFormFailure,
  mapValidationIssues,
  resolveDocumentFormCopy,
} from "./document-form-copy";
import type { DocumentFormLoadState } from "./document-form-load";
import type { DocumentFormWrite } from "./document-form-plan";
import type { DocumentFormType } from "./document-form.schema";

export type DocumentFormLookupRow = {
  readonly name: string;
  readonly description?: string;
};

export function presentDocumentFormCopy(args: {
  readonly formCopy: DocumentsCopy["form"];
  readonly submitted: boolean;
  readonly orderMessage: unknown;
  readonly mutationError: unknown;
  readonly lastWrite: DocumentFormWrite | null;
  readonly isMutationError: boolean;
  readonly pending: boolean;
  readonly clientReady: boolean;
  readonly canCreate: boolean;
  readonly created: boolean;
}): ReturnType<typeof resolveDocumentFormCopy> {
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
    orderMessage: args.orderMessage,
    server: serverFields,
  });
  return resolveDocumentFormCopy(args.formCopy, {
    orderError: fieldErrors.order,
    banner: mapDocumentFormFailure(failure?.kind ?? null, wire?.code ?? null),
    pending: args.pending,
    clientReady: args.clientReady,
    canCreate: args.canCreate,
    created: args.created,
  });
}

export function presentDocumentFormView(args: {
  readonly copy: DocumentsCopy;
  readonly loadState: DocumentFormLoadState;
  readonly resolved: ReturnType<typeof resolveDocumentFormCopy>;
  readonly type: DocumentFormType;
  readonly pending: boolean;
  readonly canCreate: boolean;
  readonly selectedOrder: DocumentFormLookupRow | null;
  readonly selectedCounterparty: DocumentFormLookupRow | undefined;
  readonly counterpartyEnabled: boolean;
  readonly orderId: string;
  readonly counterpartyId: string;
  readonly orderSheetOpen: boolean;
  readonly counterpartySheetOpen: boolean;
}): {
  readonly state: DocumentFormLoadState;
  readonly type: DocumentFormType;
  readonly orderError: string | null;
  readonly banner: string | null;
  readonly pending: boolean;
  readonly submitDisabled: boolean;
  readonly submitLabel: string;
  readonly fieldsEditable: boolean;
  readonly showSubmit: boolean;
  readonly orderValue: string | undefined;
  readonly orderSubtitle: string | undefined;
  readonly counterpartyValue: string | undefined;
  readonly counterpartySubtitle: string | undefined;
  readonly counterpartyEnabled: boolean;
  readonly orderSheetOpen: boolean;
  readonly counterpartySheetOpen: boolean;
  readonly selectedOrderId: string | null;
  readonly selectedCounterpartyId: string | null;
} {
  const showSubmit =
    documentsCreateScreenActions({ canCreate: args.canCreate }).showSubmit &&
    args.resolved.showSubmit &&
    args.loadState.kind === "ready";
  return {
    state: args.loadState,
    type: args.type,
    orderError: args.resolved.orderError,
    banner: args.resolved.banner,
    pending: args.pending,
    submitDisabled:
      args.resolved.submitDisabled || args.loadState.kind !== "ready",
    submitLabel: args.resolved.submitLabel,
    fieldsEditable:
      args.resolved.fieldsEditable && args.loadState.kind === "ready",
    showSubmit,
    orderValue: args.selectedOrder?.name,
    orderSubtitle: args.selectedOrder?.description,
    counterpartyValue: args.selectedCounterparty?.name,
    counterpartySubtitle: args.selectedCounterparty?.description,
    counterpartyEnabled: args.counterpartyEnabled,
    orderSheetOpen: args.orderSheetOpen,
    counterpartySheetOpen: args.counterpartySheetOpen,
    selectedOrderId: args.orderId.length > 0 ? args.orderId : null,
    selectedCounterpartyId:
      args.counterpartyId.length > 0 ? args.counterpartyId : null,
  };
}
