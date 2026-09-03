/**
 * Document-form view-model assembly (SHO-306 / SHO-366). Composer glue
 * (RHF, save, leave, handover, layout catalog) stays in
 * `use-document-form.ts`.
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
import {
  layoutKeyIsOffered,
  showsBasisField,
  showsLayoutPicker,
  type DocumentFormLayoutsStatus,
  type DocumentLayoutOption,
} from "./document-form-layouts";
import type { DocumentFormWrite } from "./document-form-plan";
import type { DocumentFormType } from "./document-form.schema";

export type DocumentFormLookupRow = {
  readonly name: string;
  readonly description?: string;
};

export type DocumentFormLayoutCard = {
  readonly key: string;
  readonly label: string;
};

export function presentDocumentFormCopy(args: {
  readonly formCopy: DocumentsCopy["form"];
  readonly submitted: boolean;
  readonly orderMessage: unknown;
  readonly layoutMessage: unknown;
  readonly basisMessage: unknown;
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
    layoutMessage: args.layoutMessage,
    basisMessage: args.basisMessage,
    server: serverFields,
  });
  return resolveDocumentFormCopy(args.formCopy, {
    orderError: fieldErrors.order,
    layoutError: fieldErrors.layout,
    basisError: fieldErrors.basis,
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
  readonly layoutKey: string;
  readonly layoutCards: readonly DocumentFormLayoutCard[];
  readonly layoutCatalog: readonly DocumentLayoutOption[];
  readonly layoutsStatus: DocumentFormLayoutsStatus;
  readonly layoutPreview: string | null;
  readonly orderSheetOpen: boolean;
  readonly counterpartySheetOpen: boolean;
}): {
  readonly state: DocumentFormLoadState;
  readonly type: DocumentFormType;
  readonly orderError: string | null;
  readonly layoutError: string | null;
  readonly basisError: string | null;
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
  readonly basisVisible: boolean;
  readonly layoutKey: string;
  readonly layoutCards: readonly DocumentFormLayoutCard[];
  readonly layoutsStatus: DocumentFormLayoutsStatus;
  readonly layoutPreview: string | null;
  readonly layoutSectionVisible: boolean;
  readonly orderSheetOpen: boolean;
  readonly counterpartySheetOpen: boolean;
  readonly selectedOrderId: string | null;
  readonly selectedCounterpartyId: string | null;
} {
  const showSubmit =
    documentsCreateScreenActions({ canCreate: args.canCreate }).showSubmit &&
    args.resolved.showSubmit &&
    args.loadState.kind === "ready";
  const layoutReady =
    args.layoutsStatus === "ready" &&
    layoutKeyIsOffered(args.layoutCatalog, args.layoutKey);
  return {
    state: args.loadState,
    type: args.type,
    orderError: args.resolved.orderError,
    layoutError: args.resolved.layoutError,
    basisError: args.resolved.basisError,
    banner: args.resolved.banner,
    pending: args.pending,
    submitDisabled:
      args.resolved.submitDisabled ||
      args.loadState.kind !== "ready" ||
      !layoutReady,
    submitLabel: args.resolved.submitLabel,
    fieldsEditable:
      args.resolved.fieldsEditable && args.loadState.kind === "ready",
    showSubmit,
    orderValue: args.selectedOrder?.name,
    orderSubtitle: args.selectedOrder?.description,
    counterpartyValue: args.selectedCounterparty?.name,
    counterpartySubtitle: args.selectedCounterparty?.description,
    counterpartyEnabled: args.counterpartyEnabled,
    basisVisible: showsBasisField(args.type),
    layoutKey: args.layoutKey,
    layoutCards: args.layoutCards,
    layoutsStatus: args.layoutsStatus,
    layoutPreview: args.layoutPreview,
    layoutSectionVisible: showsLayoutPicker(
      args.layoutsStatus,
      args.layoutCards.length,
    ),
    orderSheetOpen: args.orderSheetOpen,
    counterpartySheetOpen: args.counterpartySheetOpen,
    selectedOrderId: args.orderId.length > 0 ? args.orderId : null,
    selectedCounterpartyId:
      args.counterpartyId.length > 0 ? args.counterpartyId : null,
  };
}
