import { useRef } from "react";
import { useForm, useWatch } from "react-hook-form";

import { useApiClient } from "../../../api/api-provider";
import { useActiveCompany } from "../../../api/query-provider";
import { useUnsavedGuard } from "../../../components/form-kit";
import { useResolvedCompany } from "../../../company-resolution/resolved-company-provider";
import { documentsCopy } from "../../../i18n/documents";
import { detectLocale } from "../../../i18n/locale";
import {
  canCreateDocuments,
  canEditDocuments,
} from "../shared/document-permissions";
import { rhfPathsForFieldErrors } from "./document-form-copy";
import {
  cloneDocumentFormDraft,
  emptyDocumentFormDraft,
  type DocumentFormDraft,
} from "./document-form-draft";
import { classifyDocumentFormLoad } from "./document-form-load";
import { counterpartyPickerEnabled } from "./document-form-pickers";
import {
  presentDocumentFormCopy,
  presentDocumentFormView,
} from "./document-form.presenter";
import { documentFormResolver } from "./document-form.schema";
import { useDocumentFormHandover } from "./use-document-form-handover";
import { useDocumentFormLookups } from "./use-document-form-lookups";
import { useDocumentFormPickers } from "./use-document-form-pickers";
import { useDocumentSave } from "./use-document-save";

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
    getValues,
    setValue,
    handleSubmit,
    setError,
    clearErrors,
    formState,
    control,
    reset,
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
  const { armLeave, requestLeave } = useUnsavedGuard({
    dirty: isDirty && !handover.created,
    pending: saveApi.pending,
    copy: formCopy,
    sheetOpen: pickers.sheetOpen || handover.visible,
    closeSheet: pickers.closeSheets,
    armedLeave: "dispatch-only",
  });
  armLeaveRef.current = armLeave;

  const pending = saveApi.pending || handover.pending;
  const resolved = presentDocumentFormCopy({
    formCopy,
    submitted: isSubmitted,
    orderMessage: errors.orderId?.message,
    mutationError: saveApi.mutationError,
    lastWrite: saveApi.lastWrite,
    isMutationError: saveApi.isMutationError,
    pending,
    clientReady,
    canCreate,
    created: handover.created,
  });
  const presented = presentDocumentFormView({
    copy,
    loadState,
    resolved,
    type,
    pending,
    canCreate,
    selectedOrder,
    selectedCounterparty,
    counterpartyEnabled,
    orderId,
    counterpartyId,
    orderSheetOpen: pickers.orderSheetOpen,
    counterpartySheetOpen: pickers.counterpartySheetOpen,
  });

  return {
    copy,
    ...presented,
    orderOptions: lookups.orderOptions,
    counterpartyOptions: lookups.counterpartyOptions,
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
