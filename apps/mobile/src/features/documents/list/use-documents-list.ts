import { useInfiniteQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";

import { useApiClient } from "../../../api/api-provider";
import { describeQueryFailure } from "../../../api/errors";
import { useActiveCompany } from "../../../api/query-provider";
import { useResolvedCompany } from "../../../company-resolution/resolved-company-provider";
import { documentsCopy } from "../../../i18n/documents";
import { detectLocale } from "../../../i18n/locale";
import {
  listDocumentsInfiniteOptions,
  type DocumentsTypeFilter,
} from "../api/document.queries";
import { documentsHref } from "../shared/document-hrefs";
import {
  canCreateDocuments,
  canEditDocuments,
  canViewDocuments,
} from "../shared/document-permissions";
import { useDocumentSigning } from "../signing/use-document-signing";
import {
  canOpenSigningFromRow,
  classifyDocumentsList,
  documentListSignVisibility,
  documentsFilteredEmptyView,
  flattenDocumentPages,
  listDocumentsPageInput,
  toDocumentRowView,
  type DocumentsListRow,
  type DocumentsListState,
} from "./documents-list.presenter";
import { useDocumentListOptions } from "./use-document-list-options";
import { useDocumentWrites } from "./use-document-writes";

export type { DocumentsListRow };

export function useDocumentsList(args: { readonly orderId: string | null }) {
  const locale = detectLocale();
  const copy = useMemo(() => documentsCopy(locale), [locale]);
  const apiClient = useApiClient();
  const { activeCompanyId } = useActiveCompany();
  const membership = useResolvedCompany();
  const router = useRouter();
  const canView = canViewDocuments(membership.role);
  const canCreate = canCreateDocuments(membership.role);
  const canEdit = canEditDocuments(membership.role);
  const writes = useDocumentWrites({ copy, canCreate, canEdit });
  const signing = useDocumentSigning({ copy, canEdit });

  const [type, setType] = useState<DocumentsTypeFilter>("all");

  const getActiveCompany = () => apiClient?.getActiveCompany() ?? null;
  const listQuery = useInfiniteQuery(
    listDocumentsInfiniteOptions({
      client: apiClient,
      companyId: activeCompanyId,
      input: listDocumentsPageInput(type, args.orderId),
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
      const sign = documentListSignVisibility({
        canEdit,
        status: view.status,
        supplierSigned: entry.supplierSigned,
      });
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
        showSign: sign.showSign,
        showSignedChip: sign.showSignedChip,
      };
    });
  }, [listQuery.data?.pages, locale, copy, canEdit]);

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
  const options = useDocumentListOptions({
    copy,
    canView,
    rows,
    writes,
    onSign: signing.requestSignAndOpen,
  });

  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const requestSignRef = useRef(signing.requestSignAndOpen);
  requestSignRef.current = signing.requestSignAndOpen;
  const signingVisibleRef = useRef(signing.session.visible);
  signingVisibleRef.current = signing.session.visible;

  const signRow = useCallback((id: string) => {
    const row = rowsRef.current.find((entry) => entry.id === id);
    if (
      row === undefined ||
      !canOpenSigningFromRow({
        showSign: row.showSign,
        signingSheetOpen: signingVisibleRef.current,
      })
    ) {
      return;
    }
    void requestSignRef.current({
      id: row.id,
      documentNumber: row.documentNumber,
    });
  }, []);

  return {
    copy,
    state,
    rows,
    type,
    changeType: setType,
    resetFilters: () => {
      if (type !== "all") {
        setType("all");
        return;
      }
      if (args.orderId !== null) {
        router.replace(documentsHref());
      }
    },
    filteredEmpty: documentsFilteredEmptyView({
      type,
      orderId: args.orderId,
      copy,
    }),
    canView,
    canCreate,
    canEdit,
    banner: writes.banner ?? signing.banner,
    writesPending: writes.pending || signing.pending,
    signRow,
    signingSession: signing.session,
    closeSigning: signing.closeSheet,
    onSigningHidden: signing.onSheetHidden,
    pickSigningKey: signing.pickKey,
    setSigningPassword: signing.setPassword,
    submitSigning: signing.submit,
    ...options,
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
  };
}

export type DocumentsListModel = ReturnType<typeof useDocumentsList>;
