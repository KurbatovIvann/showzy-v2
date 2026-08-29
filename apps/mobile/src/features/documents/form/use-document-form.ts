import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Linking, Share } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useForm, useWatch } from "react-hook-form";

import { useApiClient } from "../../../api/api-provider";
import { useContractMutation } from "../../../api/contract-mutation";
import { describeQueryFailure, describeWireError } from "../../../api/errors";
import { useActiveCompany } from "../../../api/query-provider";
import { useResolvedCompany } from "../../../company-resolution/resolved-company-provider";
import { documentsCopy } from "../../../i18n/documents";
import { detectLocale } from "../../../i18n/locale";
import { getDocumentQueryOptions } from "../api/document-detail-query";
import {
  bindDocumentMutate,
  shareUrlFromResult,
  type DocumentWrite,
} from "../api/document-writes";
import { documentsHref } from "../shared/document-hrefs";
import {
  canCreateDocuments,
  canEditDocuments,
  documentsCreateScreenActions,
} from "../shared/document-permissions";
import {
  hideDocumentHandover,
  IDLE_DOCUMENT_HANDOVER,
  openDocumentHandover,
  documentHandoverHidden,
  type DocumentHandoverChrome,
} from "../share/document-handover-chrome";
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
import type { CreateFromOrderResult } from "./document-form-plan";
import { documentFormResolver } from "./document-form.schema";
import { useDocumentFormLookups } from "./use-document-form-lookups";
import { useDocumentSave } from "./use-document-save";
import { useUnsavedDocumentGuard } from "./use-unsaved-document-guard";

export type DocumentFormModel = ReturnType<typeof useDocumentForm>;

export function useDocumentForm() {
  const locale = detectLocale();
  const copy = documentsCopy(locale);
  const formCopy = copy.form;
  const router = useRouter();
  const apiClient = useApiClient();
  const apiRef = useRef(apiClient);
  apiRef.current = apiClient;
  const { activeCompanyId } = useActiveCompany();
  const queryClient = useQueryClient();
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

  const [orderSheetOpen, setOrderSheetOpen] = useState(false);
  const [counterpartySheetOpen, setCounterpartySheetOpen] = useState(false);
  const [handoverChrome, setHandoverChrome] = useState<DocumentHandoverChrome>(
    IDLE_DOCUMENT_HANDOVER,
  );
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [created, setCreated] = useState(false);
  const createdDocumentIdRef = useRef<string | null>(null);

  const clientReady = apiClient !== null && activeCompanyId !== null;
  const loadState = classifyDocumentFormLoad({
    canCreate,
    clientReady,
  });

  const lookups = useDocumentFormLookups({
    enabled: loadState.kind === "ready",
    orderId,
  });

  const armLeaveRef = useRef(() => {});

  const shareMutation = useContractMutation(
    (input: Extract<DocumentWrite, { kind: "share" }>, options) => {
      const current = apiRef.current;
      if (current === null) {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      return bindDocumentMutate(current)(input, options);
    },
  );

  async function mintShareUrl(documentId: string): Promise<string | null> {
    if (!canEdit) {
      return null;
    }
    try {
      const result = await shareMutation.submit({
        kind: "share",
        documentId,
      });
      const url = shareUrlFromResult(result);
      shareMutation.reset();
      return url;
    } catch {
      return null;
    }
  }

  const saveApi = useDocumentSave({
    loadKind: loadState.kind,
    getDraft: () => cloneDocumentFormDraft(getValues()),
    setOrigin: (draft) => {
      reset(draft);
    },
    onSaved: async (result: CreateFromOrderResult) => {
      setCreated(true);
      createdDocumentIdRef.current = result.documentId;
      armLeaveRef.current();
      if (!canEdit) {
        router.replace(documentsHref());
        return;
      }
      const url = await mintShareUrl(result.documentId);
      if (url === null) {
        router.replace(documentsHref());
        return;
      }
      setCopied(false);
      setCopyFailed(false);
      setHandoverChrome(
        openDocumentHandover({
          url,
          documentNumber: result.documentNumber,
        }),
      );
    },
    setFieldErrors: (nextFieldErrors) => {
      for (const entry of rhfPathsForFieldErrors(nextFieldErrors)) {
        setError(entry.name, { type: "validate", message: entry.message });
      }
    },
  });

  function closeAllSheets(): void {
    setOrderSheetOpen(false);
    setCounterpartySheetOpen(false);
  }

  const { armLeave, requestLeave } = useUnsavedDocumentGuard({
    dirty: isDirty && !created,
    pending: saveApi.pending,
    copy: formCopy,
    sheetOpen:
      orderSheetOpen || counterpartySheetOpen || handoverChrome.visible,
    closeSheet: closeAllSheets,
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
  const mappedBanner = mapDocumentFormFailure(
    failure?.kind ?? null,
    wire?.code ?? null,
  );
  const pending = saveApi.pending || shareMutation.isPending;
  const resolved = resolveDocumentFormCopy(formCopy, {
    orderError: fieldErrors.order,
    banner: mappedBanner,
    pending,
    clientReady,
    canCreate,
  });
  const showSubmit =
    documentsCreateScreenActions({ canCreate }).showSubmit &&
    resolved.showSubmit &&
    loadState.kind === "ready";

  const selectedOrder = lookups.selectedOrder;
  const selectedCounterparty = lookups.counterpartyOptions.find(
    (row) => row.id === counterpartyId,
  );
  const counterpartyEnabled = counterpartyPickerEnabled({
    orderId,
    customerId: selectedOrder?.customerId ?? null,
  });

  function onFieldEdit(): void {
    clearErrors();
    saveApi.resetMutation();
  }

  async function openPanelPdf(documentId: string): Promise<void> {
    const current = apiRef.current;
    if (current === null || activeCompanyId === null) {
      return;
    }
    try {
      const view = await queryClient.fetchQuery(
        getDocumentQueryOptions({
          client: current,
          companyId: activeCompanyId,
          documentId,
          getActiveCompany: () => apiRef.current?.getActiveCompany() ?? null,
        }),
      );
      if (view.generation.status === "failed" || view.pdfDownloadUrl === null) {
        return;
      }
      await Linking.openURL(view.pdfDownloadUrl);
    } catch {
      // Print is best-effort after create; list toasts cover the options path.
    }
  }

  return {
    copy,
    control,
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
    orderSheetOpen,
    counterpartySheetOpen,
    orderOptions: lookups.orderOptions,
    counterpartyOptions: lookups.counterpartyOptions,
    selectedOrderId: orderId.length > 0 ? orderId : null,
    selectedCounterpartyId: counterpartyId.length > 0 ? counterpartyId : null,
    handoverVisible: handoverChrome.visible,
    handoverUrl: handoverChrome.url,
    handoverTitle: handoverChrome.documentNumber ?? copy.handover.title,
    copied,
    copyFailed,
    onFieldEdit,
    requestLeave,
    openOrderSheet: () => {
      setCounterpartySheetOpen(false);
      setOrderSheetOpen(true);
    },
    openCounterpartySheet: () => {
      if (!counterpartyEnabled) {
        return;
      }
      setOrderSheetOpen(false);
      setCounterpartySheetOpen(true);
    },
    closeOrderSheet: () => {
      setOrderSheetOpen(false);
    },
    closeCounterpartySheet: () => {
      setCounterpartySheetOpen(false);
    },
    pickOrder: (id: string) => {
      setValue("orderId", id, { shouldDirty: true });
      setValue("counterpartyId", "", { shouldDirty: true });
      setOrderSheetOpen(false);
      onFieldEdit();
    },
    pickCounterparty: (id: string | null) => {
      setValue("counterpartyId", id ?? "", { shouldDirty: true });
      setCounterpartySheetOpen(false);
      onFieldEdit();
    },
    setType: (next: DocumentFormDraft["type"]) => {
      setValue("type", next, { shouldDirty: true });
      onFieldEdit();
    },
    closeHandover: () => {
      setHandoverChrome(hideDocumentHandover);
    },
    onHandoverHidden: () => {
      setHandoverChrome(documentHandoverHidden);
      setCopied(false);
      setCopyFailed(false);
      if (created && !handoverChrome.visible) {
        router.replace(documentsHref());
      }
    },
    copyHandover: async () => {
      if (handoverChrome.url === null) {
        return;
      }
      try {
        await Clipboard.setStringAsync(handoverChrome.url);
        setCopied(true);
        setCopyFailed(false);
      } catch {
        setCopied(false);
        setCopyFailed(true);
      }
    },
    shareHandover: async () => {
      if (handoverChrome.url === null) {
        return;
      }
      try {
        await Share.share({ message: handoverChrome.url });
      } catch {
        setCopyFailed(true);
      }
    },
    printHandover: () => {
      const documentId = createdDocumentIdRef.current;
      if (documentId === null) {
        return;
      }
      void openPanelPdf(documentId);
    },
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
