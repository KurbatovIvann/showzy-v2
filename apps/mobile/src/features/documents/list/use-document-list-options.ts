/**
 * Options / handover chrome, `documents.get` load, and sheet follow-ups
 * (SHO-237). Composer stays query + presenter + navigation.
 */
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApiClient } from "../../../api/api-provider";
import { describeQueryFailure } from "../../../api/errors";
import { useActiveCompany } from "../../../api/query-provider";
import { presentConfirmDialog } from "../../../components/ui/present-confirm-dialog";
import type { DocumentsCopy } from "../../../i18n/documents";
import { getDocumentQueryOptions } from "../api/document-detail-query";
import { useSheetHiddenWaiter } from "../shared/use-sheet-hidden-waiter";
import {
  documentHandoverHidden,
  documentOptionsHidden,
  hideDocumentHandover,
  hideDocumentOptions,
  IDLE_DOCUMENT_HANDOVER,
  IDLE_DOCUMENT_OPTIONS,
  openDocumentHandover,
  openDocumentOptions,
  waitThenConfirmDocumentCancel,
  waitThenRunDocumentFollowUp,
  type DocumentHandoverChrome,
  type DocumentOptionsChrome,
} from "./document-options-handshake";
import {
  classifyDocumentOptionsGet,
  type DocumentOptionsGetLoadState,
  type DocumentsListRow,
} from "./documents-list.presenter";
import { type DocumentWritesApi } from "./use-document-writes";

export function useDocumentListOptions(args: {
  readonly copy: DocumentsCopy;
  readonly canView: boolean;
  readonly rows: readonly DocumentsListRow[];
  readonly writes: DocumentWritesApi;
}) {
  const apiClient = useApiClient();
  const { activeCompanyId } = useActiveCompany();
  const [optionsChrome, setOptionsChrome] = useState<DocumentOptionsChrome>(
    IDLE_DOCUMENT_OPTIONS,
  );
  const [handoverChrome, setHandoverChrome] = useState<DocumentHandoverChrome>(
    IDLE_DOCUMENT_HANDOVER,
  );
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const optionsHidden = useSheetHiddenWaiter();
  const handoverHidden = useSheetHiddenWaiter();

  const detailQuery = useQuery(
    getDocumentQueryOptions({
      client: apiClient,
      companyId: activeCompanyId,
      documentId: optionsChrome.documentId,
      getActiveCompany: () => apiClient?.getActiveCompany() ?? null,
    }),
  );
  const getLoad: DocumentOptionsGetLoadState = classifyDocumentOptionsGet({
    documentId: optionsChrome.documentId,
    clientReady: apiClient !== null && activeCompanyId !== null && args.canView,
    status: detailQuery.status,
    failureKind: detailQuery.isError
      ? describeQueryFailure(detailQuery.error).kind
      : null,
  });
  const getReady = getLoad.kind === "ready";
  const generationStatus = getReady
    ? (detailQuery.data?.generation.status ?? null)
    : null;
  const pdfDownloadUrl = getReady
    ? (detailQuery.data?.pdfDownloadUrl ?? null)
    : null;
  const optionsRow =
    args.rows.find((row) => row.id === optionsChrome.documentId) ?? null;

  function hideOptions(): void {
    setOptionsChrome(hideDocumentOptions);
  }

  async function mintThen(handover: boolean): Promise<void> {
    if (optionsRow === null) {
      return;
    }
    const target = optionsRow;
    await waitThenRunDocumentFollowUp({
      waitHidden: optionsHidden.wait,
      hide: hideOptions,
      run: async () => {
        const url = await args.writes.mintShareUrl(target.id);
        if (url === null) {
          return;
        }
        if (handover) {
          setHandoverChrome(
            openDocumentHandover({
              url,
              documentNumber: target.documentNumber,
            }),
          );
          return;
        }
        await args.writes.shareUrl(url);
      },
    });
  }

  return {
    optionsVisible: optionsChrome.visible,
    optionsRow,
    getLoad: getLoad.kind,
    generationStatus,
    pdfDownloadUrl,
    openOptions: (id: string) => {
      setCopied(false);
      setCopyFailed(false);
      setOptionsChrome(openDocumentOptions(id));
    },
    closeOptions: () => {
      hideOptions();
    },
    onOptionsHidden: () => {
      optionsHidden.notify();
      setOptionsChrome(documentOptionsHidden);
    },
    handoverVisible: handoverChrome.visible,
    handoverUrl: handoverChrome.url,
    handoverTitle: handoverChrome.documentNumber ?? args.copy.handover.title,
    copied,
    copyFailed,
    closeHandover: () => {
      setHandoverChrome(hideDocumentHandover);
    },
    onHandoverHidden: () => {
      handoverHidden.notify();
      setHandoverChrome(documentHandoverHidden);
      setCopied(false);
      setCopyFailed(false);
    },
    copyHandover: async () => {
      if (handoverChrome.url === null) {
        return;
      }
      const result = await args.writes.copyUrl(handoverChrome.url);
      setCopied(result === "ok");
      setCopyFailed(result !== "ok");
    },
    shareHandover: async () => {
      if (handoverChrome.url === null) {
        return;
      }
      await args.writes.shareUrl(handoverChrome.url);
    },
    share: () => {
      void mintThen(false);
    },
    openQr: () => {
      void mintThen(true);
    },
    openPdf: async () => {
      if (optionsRow === null) {
        return;
      }
      const id = optionsRow.id;
      await waitThenRunDocumentFollowUp({
        waitHidden: optionsHidden.wait,
        hide: hideOptions,
        run: () => args.writes.openPanelPdf(id),
      });
    },
    print: async () => {
      if (optionsRow === null) {
        return;
      }
      const id = optionsRow.id;
      await waitThenRunDocumentFollowUp({
        waitHidden: optionsHidden.wait,
        hide: hideOptions,
        run: () => args.writes.openPanelPdf(id),
      });
    },
    cancel: async () => {
      if (optionsRow === null) {
        return;
      }
      const target = optionsRow;
      const choice = await waitThenConfirmDocumentCancel({
        waitHidden: optionsHidden.wait,
        hide: hideOptions,
        presentConfirmDialog,
        confirm: {
          title: args.copy.confirm.cancelTitle,
          message: args.copy.confirm.cancelDescription,
          confirmLabel: args.copy.confirm.cancelConfirm,
          cancelLabel: args.copy.confirm.dismiss,
          tone: "danger",
        },
      });
      if (choice !== "confirm") {
        return;
      }
      await args.writes.cancel(target);
    },
  };
}
