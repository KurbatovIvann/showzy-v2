import { useRef } from "react";
import { useForm, useWatch } from "react-hook-form";

import { useApiClient } from "../../../api/api-provider";
import { describeQueryFailure, describeWireError } from "../../../api/errors";
import { useActiveCompany } from "../../../api/query-provider";
import { useResolvedCompany } from "../../../company-resolution/resolved-company-provider";
import { documentsCopy } from "../../../i18n/documents";
import { detectLocale } from "../../../i18n/locale";
import {
  canCreateDocuments,
  canEditDocuments,
  documentsCreateScreenActions,
} from "../shared/document-permissions";
import {
  fieldErrorsFromFormState,
  mapDocumentFormFailure,
  mapValidationIssues,
  resolveDocumentFormCopy,
  rhfPathsForFieldErrors,
} from "./document-form-copy";
import {
  cloneDocumentFormDraft,
  emptyDocumentFormDraft,
  type DocumentFormDraft,
} from "./document-form-draft";
import { classifyDocumentFormLoad } from "./document-form-load";
import { counterpartyPickerEnabled } from "./document-form-pickers";
import { documentFormResolver } from "./document-form.schema";
import { useDocumentFormHandover } from "./use-document-form-handover";
import { useDocumentFormLookups } from "./use-document-form-lookups";
import { useDocumentFormPickers } from "./use-document-form-pickers";
import { useDocumentSave } from "./use-document-save";
import { useUnsavedDocumentGuard } from "./use-unsaved-document-guard";

export type DocumentFormModel = ReturnType<typeof useDocumentForm>;

export function useDocumentForm() {
  const locale = detectLocale();
  const copy = documentsCopy(locale);
  const formCopy = copy.form;
  const apiClient = useApiClient();
  const { activeCompanyId } = useActiveCompany();
  const membership = useResolvedCompany();
  const canCreate = canCreateDocuments(membership.role);
  const canEdit = canEditDocuments(membership.role);

  const {
    control,
    reset,
    getValues,
    setValue,
    handleSubmit,
    setError,
    clearErrors,
    formState,
  } = useForm<DocumentFormDraft>({
    defaultValues: emptyDocumentFormDraft(),
    resolver: documentFormResolver,
    mode: "onSubmit",
  });
  const { isDirty, errors, isSubmitted } = formState;
  const type = useWatch({ control, name: "type" });
  const orderId = useWatch({ control, name: "orderId" });
  const counterpartyId = useWatch({ control, name: "counterpartyId" });

  const handover = useDocumentFormHandover({ copy, canEdit });
  const clientReady = apiClient !== null && activeCompanyId !== null;
  const loadState = classifyDocumentFormLoad({
    canCreate,
    clientReady,
  });
  const lookups = useDocumentFormLookups({
    enabled: loadState.kind === "ready",
    orderId,
  });
  const selectedOrder = lookups.selectedOrder;
  const selectedCounterparty = lookups.counterpartyOptions.find(
    (row) => row.id === counterpartyId,
  );
  const counterpartyEnabled = counterpartyPickerEnabled({
    orderId,
    customerId: selectedOrder?.customerId ?? null,
  });

  const armLeaveRef = useRef(() => {});
  const saveApi = useDocumentSave({
    loadKind: loadState.kind,
    getDraft: () => cloneDocumentFormDraft(getValues()),
    setOrigin: (draft) => {
      reset(draft);
    },
    onSaved: async (result) => {
      armLeaveRef.current();
      await handover.afterCreate(result);
    },
    setFieldErrors: (nextFieldErrors) => {
      for (const entry of rhfPathsForFieldErrors(nextFieldErrors)) {
        setError(entry.name, { type: "validate", message: entry.message });
      }
    },
  });

  function onFieldEdit(): void {
    clearErrors();
    saveApi.resetMutation();
  }

  const pickers = useDocumentFormPickers({
    counterpartyEnabled,
    setValue,
    onFieldEdit,
  });
  const { armLeave, requestLeave } = useUnsavedDocumentGuard({
    dirty: isDirty && !handover.created,
    pending: saveApi.pending,
    copy: formCopy,
    sheetOpen: pickers.sheetOpen || handover.visible,
    closeSheet: pickers.closeSheets,
  });
  armLeaveRef.current = armLeave;

  const failure = saveApi.isMutationError
    ? describeQueryFailure(saveApi.mutationError)
    : null;
  const wire = saveApi.isMutationError
    ? describeWireError(saveApi.mutationError)
    : null;
  const serverFields = saveApi.isMutationError
    ? mapValidationIssues(saveApi.mutationError, saveApi.lastWrite)
    : null;
  const fieldErrors = fieldErrorsFromFormState({
    submitted: isSubmitted,
    orderMessage: errors.orderId?.message,
    server: serverFields,
  });
  const pending = saveApi.pending || handover.pending;
  const resolved = resolveDocumentFormCopy(formCopy, {
    orderError: fieldErrors.order,
    banner: mapDocumentFormFailure(failure?.kind ?? null, wire?.code ?? null),
    pending,
    clientReady,
    canCreate,
    created: handover.created,
  });
  const showSubmit =
    documentsCreateScreenActions({ canCreate }).showSubmit &&
    resolved.showSubmit &&
    loadState.kind === "ready";

  return {
    copy,
    state: loadState,
    type,
    orderError: resolved.orderError,
    banner: resolved.banner,
    pending,
    submitDisabled: resolved.submitDisabled || loadState.kind !== "ready",
    submitLabel: resolved.submitLabel,
    fieldsEditable: resolved.fieldsEditable && loadState.kind === "ready",
    showSubmit,
    orderValue: selectedOrder?.name,
    orderSubtitle: selectedOrder?.description,
    counterpartyValue: selectedCounterparty?.name,
    counterpartySubtitle: selectedCounterparty?.description,
    counterpartyEnabled,
    orderSheetOpen: pickers.orderSheetOpen,
    counterpartySheetOpen: pickers.counterpartySheetOpen,
    orderOptions: lookups.orderOptions,
    counterpartyOptions: lookups.counterpartyOptions,
    selectedOrderId: orderId.length > 0 ? orderId : null,
    selectedCounterpartyId: counterpartyId.length > 0 ? counterpartyId : null,
    handoverVisible: handover.visible,
    handoverUrl: handover.url,
    handoverTitle: handover.title,
    copied: handover.copied,
    copyFailed: handover.copyFailed,
    requestLeave,
    openOrderSheet: pickers.openOrderSheet,
    openCounterpartySheet: pickers.openCounterpartySheet,
    closeOrderSheet: pickers.closeOrderSheet,
    closeCounterpartySheet: pickers.closeCounterpartySheet,
    pickOrder: pickers.pickOrder,
    pickCounterparty: pickers.pickCounterparty,
    setType: pickers.setType,
    closeHandover: handover.closeHandover,
    onHandoverHidden: handover.onHandoverHidden,
    copyHandover: handover.copyHandover,
    shareHandover: handover.shareHandover,
    printHandover: handover.printHandover,
    save: () => {
      void handleSubmit(
        () => {
          void saveApi.save();
        },
        () => {
          saveApi.resetMutation();
        },
      )();
    },
  };
}
