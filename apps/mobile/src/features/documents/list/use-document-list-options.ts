/**
 * Options / handover chrome, `documents.get` load, and sheet follow-ups
 * (SHO-237 / SHO-306). Composer stays query + presenter + navigation.
 * Callbacks are ref-stable so list row `memo` can bail.
 */
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";

import { useApiClient } from "../../../api/api-provider";
import { describeQueryFailure } from "../../../api/errors";
import { useActiveCompany } from "../../../api/query-provider";
import { presentConfirmDialog } from "../../../components/ui/present-confirm-dialog";
import { useSheetHiddenWaiter } from "../../../hooks/use-sheet-hidden-waiter";
import type { DocumentsCopy } from "../../../i18n/documents";
import { getDocumentQueryOptions } from "../api/document-detail-query";
import {
  documentHandoverHidden,
  hideDocumentHandover,
  IDLE_DOCUMENT_HANDOVER,
  openDocumentHandover,
  type DocumentHandoverChrome,
} from "../share/document-handover-chrome";
import type { DocumentSigningTarget } from "../signing/use-document-signing";
import {
  documentOptionsRowForId,
  presentDocumentOptionsGetFields,
} from "./document-list-options.presenter";
import {
  documentOptionsHidden,
  hideDocumentOptions,
  IDLE_DOCUMENT_OPTIONS,
  openDocumentOptions,
  waitThenConfirmDocumentCancel,
  waitThenRunDocumentFollowUp,
  type DocumentOptionsChrome,
} from "./document-options-handshake";
import {
  canOpenSigningFromRow,
  classifyDocumentOptionsGet,
  type DocumentsListRow,
} from "./documents-list.presenter";
import { type DocumentWritesApi } from "./use-document-writes";

export function useDocumentListOptions(args: {
  readonly copy: DocumentsCopy;
  readonly canView: boolean;
  readonly rows: readonly DocumentsListRow[];
  readonly writes: DocumentWritesApi;
  readonly onSign: (target: DocumentSigningTarget) => Promise<void>;
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
  const argsRef = useRef(args);
  argsRef.current = args;
  const optionsHiddenRef = useRef(optionsHidden);
  optionsHiddenRef.current = optionsHidden;
  const handoverHiddenRef = useRef(handoverHidden);
  handoverHiddenRef.current = handoverHidden;
  const handoverChromeRef = useRef(handoverChrome);
  handoverChromeRef.current = handoverChrome;

  const detailQuery = useQuery(
    getDocumentQueryOptions({
      client: apiClient,
      companyId: activeCompanyId,
      documentId: optionsChrome.documentId,
      getActiveCompany: () => apiClient?.getActiveCompany() ?? null,
    }),
  );
  const getLoad = classifyDocumentOptionsGet({
    documentId: optionsChrome.documentId,
    clientReady: apiClient !== null && activeCompanyId !== null && args.canView,
    status: detailQuery.status,
    failureKind: detailQuery.isError
      ? describeQueryFailure(detailQuery.error).kind
      : null,
  });
  const getFields = presentDocumentOptionsGetFields({
    getLoad,
    generationStatus: detailQuery.data?.generation.status,
    pdfDownloadUrl: detailQuery.data?.pdfDownloadUrl,
    signingStatus: detailQuery.data?.signing.status,
  });
  const optionsRow = documentOptionsRowForId(
    args.rows,
    optionsChrome.documentId,
  );
  const optionsRowRef = useRef(optionsRow);
  optionsRowRef.current = optionsRow;

  const hideOptions = useCallback(() => {
    setOptionsChrome(hideDocumentOptions);
  }, []);

  const mintThen = useCallback(async (handover: boolean): Promise<void> => {
    const target = optionsRowRef.current;
    if (target === null) {
      return;
    }
    await waitThenRunDocumentFollowUp({
      waitHidden: () => optionsHiddenRef.current.wait(),
      hide: hideOptions,
      run: async () => {
        const url = await argsRef.current.writes.mintShareUrl(target.id);
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
        await argsRef.current.writes.shareUrl(url);
      },
    });
  }, [hideOptions]);

  const openOptions = useCallback((id: string) => {
    setCopied(false);
    setCopyFailed(false);
    setOptionsChrome(openDocumentOptions(id));
  }, []);

  const closeOptions = useCallback(() => {
    hideOptions();
  }, [hideOptions]);

  const onOptionsHidden = useCallback(() => {
    optionsHiddenRef.current.notify();
    setOptionsChrome(documentOptionsHidden);
  }, []);

  const closeHandover = useCallback(() => {
    setHandoverChrome(hideDocumentHandover);
  }, []);

  const onHandoverHidden = useCallback(() => {
    handoverHiddenRef.current.notify();
    setHandoverChrome(documentHandoverHidden);
    setCopied(false);
    setCopyFailed(false);
  }, []);

  const copyHandover = useCallback(async () => {
    const url = handoverChromeRef.current.url;
    if (url === null) {
      return;
    }
    const result = await argsRef.current.writes.copyUrl(url);
    setCopied(result === "ok");
    setCopyFailed(result !== "ok");
  }, []);

  const shareHandover = useCallback(async () => {
    const url = handoverChromeRef.current.url;
    if (url === null) {
      return;
    }
    await argsRef.current.writes.shareUrl(url);
  }, []);

  const share = useCallback(() => {
    void mintThen(false);
  }, [mintThen]);

  const openQr = useCallback(() => {
    void mintThen(true);
  }, [mintThen]);

  const openPdf = useCallback(async () => {
    const target = optionsRowRef.current;
    if (target === null) {
      return;
    }
    const id = target.id;
    await waitThenRunDocumentFollowUp({
      waitHidden: () => optionsHiddenRef.current.wait(),
      hide: hideOptions,
      run: () => argsRef.current.writes.openPanelPdf(id),
    });
  }, [hideOptions]);

  const sign = useCallback(async () => {
    const target = optionsRowRef.current;
    if (target === null) {
      return;
    }
    if (
      !canOpenSigningFromRow({
        showSign: target.showSign,
        signingSheetOpen: false,
      })
    ) {
      return;
    }
    await waitThenRunDocumentFollowUp({
      waitHidden: () => optionsHiddenRef.current.wait(),
      hide: hideOptions,
      run: () =>
        argsRef.current.onSign({
          id: target.id,
          documentNumber: target.documentNumber,
        }),
    });
  }, [hideOptions]);

  const print = useCallback(async () => {
    const target = optionsRowRef.current;
    if (target === null) {
      return;
    }
    const id = target.id;
    await waitThenRunDocumentFollowUp({
      waitHidden: () => optionsHiddenRef.current.wait(),
      hide: hideOptions,
      run: () => argsRef.current.writes.openPanelPdf(id),
    });
  }, [hideOptions]);

  const cancel = useCallback(async () => {
    const target = optionsRowRef.current;
    if (target === null) {
      return;
    }
    const choice = await waitThenConfirmDocumentCancel({
      waitHidden: () => optionsHiddenRef.current.wait(),
      hide: hideOptions,
      presentConfirmDialog,
      confirm: {
        title: argsRef.current.copy.confirm.cancelTitle,
        message: argsRef.current.copy.confirm.cancelDescription,
        confirmLabel: argsRef.current.copy.confirm.cancelConfirm,
        cancelLabel: argsRef.current.copy.confirm.dismiss,
        tone: "danger",
      },
    });
    if (choice !== "confirm") {
      return;
    }
    await argsRef.current.writes.cancel(target);
  }, [hideOptions]);

  return useMemo(
    () => ({
      optionsVisible: optionsChrome.visible,
      optionsRow,
      getLoad: getLoad.kind,
      generationStatus: getFields.generationStatus,
      pdfDownloadUrl: getFields.pdfDownloadUrl,
      signingStatus: getFields.signingStatus,
      openOptions,
      closeOptions,
      onOptionsHidden,
      handoverVisible: handoverChrome.visible,
      handoverUrl: handoverChrome.url,
      handoverTitle: handoverChrome.documentNumber ?? args.copy.handover.title,
      copied,
      copyFailed,
      closeHandover,
      onHandoverHidden,
      copyHandover,
      shareHandover,
      share,
      openQr,
      openPdf,
      sign,
      print,
      cancel,
    }),
    [
      args.copy.handover.title,
      copied,
      copyFailed,
      copyHandover,
      closeHandover,
      closeOptions,
      cancel,
      getFields.generationStatus,
      getFields.pdfDownloadUrl,
      getFields.signingStatus,
      getLoad.kind,
      handoverChrome.documentNumber,
      handoverChrome.url,
      handoverChrome.visible,
      onHandoverHidden,
      onOptionsHidden,
      openOptions,
      openPdf,
      openQr,
      optionsChrome.visible,
      optionsRow,
      print,
      share,
      shareHandover,
      sign,
    ],
  );
}
