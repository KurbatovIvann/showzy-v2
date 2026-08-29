import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { useApiClient } from "../../../api/api-provider";
import { describeQueryFailure } from "../../../api/errors";
import { useActiveCompany } from "../../../api/query-provider";
import { useResolvedCompany } from "../../../company-resolution/resolved-company-provider";
import { presentConfirmDialog } from "../../../components/ui/present-confirm-dialog";
import { documentsCopy } from "../../../i18n/documents";
import { detectLocale } from "../../../i18n/locale";
import { getDocumentQueryOptions } from "../api/document-detail-query";
import {
  listDocumentsInfiniteOptions,
  type DocumentsTypeFilter,
} from "../api/document.queries";
import {
  canCreateDocuments,
  canEditDocuments,
  canViewDocuments,
} from "../shared/document-permissions";
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
  classifyDocumentsList,
  flattenDocumentPages,
  listDocumentsPageInput,
  toDocumentRowView,
  type DocumentsListState,
} from "./documents-list.presenter";
import { useDocumentWrites } from "./use-document-writes";

export type DocumentsListRow = {
  readonly id: string;
  readonly documentNumber: string;
  readonly typeLabel: string;
  readonly buyerLabel: string;
  readonly issuedOnLabel: string;
  readonly totalLabel: string;
  readonly cancelled: boolean;
  readonly status: "issued" | "cancelled";
  readonly optionsA11y: string;
};

export function useDocumentsList(args: { readonly orderId: string | null }) {
  const locale = detectLocale();
  const copy = useMemo(() => documentsCopy(locale), [locale]);
  const apiClient = useApiClient();
  const { activeCompanyId } = useActiveCompany();
  const membership = useResolvedCompany();
  const canView = canViewDocuments(membership.role);
  const canCreate = canCreateDocuments(membership.role);
  const canEdit = canEditDocuments(membership.role);
  const writes = useDocumentWrites({ copy, canCreate, canEdit });

  const [type, setType] = useState<DocumentsTypeFilter>("all");
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

  const getActiveCompany = () => apiClient?.getActiveCompany() ?? null;
  const listQuery = useInfiniteQuery(
    listDocumentsInfiniteOptions({
      client: apiClient,
      companyId: activeCompanyId,
      input: listDocumentsPageInput(type, args.orderId),
      getActiveCompany,
    }),
  );
  const detailQuery = useQuery(
    getDocumentQueryOptions({
      client: apiClient,
      companyId: activeCompanyId,
      documentId: optionsChrome.documentId,
      getActiveCompany,
    }),
  );

  const rows = useMemo((): readonly DocumentsListRow[] => {
    const pages = listQuery.data?.pages;
    if (pages === undefined) {
      return [];
    }
    return flattenDocumentPages(pages).map((entry) => {
      const view = toDocumentRowView(entry, { locale, copy });
      return {
        id: view.id,
        documentNumber: view.documentNumber,
        typeLabel: view.typeLabel,
        buyerLabel: view.buyerLabel,
        issuedOnLabel: view.issuedOnLabel,
        totalLabel: view.totalLabel,
        cancelled: view.cancelled,
        status: view.status,
        optionsA11y: view.optionsA11y,
      };
    });
  }, [listQuery.data?.pages, locale, copy]);

  const failureKind = listQuery.isError
    ? describeQueryFailure(listQuery.error).kind
    : null;
  const state: DocumentsListState = classifyDocumentsList({
    clientReady: apiClient !== null && activeCompanyId !== null && canView,
    status: listQuery.status,
    failureKind,
    rowCount: rows.length,
    type,
    orderId: args.orderId,
  });
  const optionsRow =
    rows.find((row) => row.id === optionsChrome.documentId) ?? null;

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
        const url = await writes.mintShareUrl(target.id);
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
        await writes.shareUrl(url);
      },
    });
  }

  return {
    copy,
    state,
    rows,
    type,
    changeType: setType,
    resetFilters: () => {
      setType("all");
    },
    canView,
    canCreate,
    canEdit,
    banner: writes.banner,
    writesPending: writes.pending,
    optionsVisible: optionsChrome.visible,
    optionsRow,
    generationStatus: detailQuery.data?.generation.status ?? null,
    pdfDownloadUrl: detailQuery.data?.pdfDownloadUrl ?? null,
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
    handoverTitle: handoverChrome.documentNumber ?? copy.handover.title,
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
      const result = await writes.copyUrl(handoverChrome.url);
      setCopied(result === "ok");
      setCopyFailed(result !== "ok");
    },
    shareHandover: async () => {
      if (handoverChrome.url === null) {
        return;
      }
      await writes.shareUrl(handoverChrome.url);
    },
    refreshing: listQuery.isRefetching && !listQuery.isFetchingNextPage,
    refresh: () => {
      void listQuery.refetch();
    },
    retry: () => {
      void listQuery.refetch();
    },
    loadingMore: listQuery.isFetchingNextPage,
    loadMore: () => {
      if (listQuery.hasNextPage && !listQuery.isFetchingNextPage) {
        void listQuery.fetchNextPage();
      }
    },
    goBack: writes.goBack,
    openCreate: writes.openCreate,
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
        run: () => writes.openPanelPdf(id),
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
        run: () => writes.openPanelPdf(id),
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
          title: copy.confirm.cancelTitle,
          message: copy.confirm.cancelDescription,
          confirmLabel: copy.confirm.cancelConfirm,
          cancelLabel: copy.confirm.dismiss,
          tone: "danger",
        },
      });
      if (choice !== "confirm") {
        return;
      }
      await writes.cancel(target);
    },
  };
}

export type DocumentsListModel = ReturnType<typeof useDocumentsList>;
