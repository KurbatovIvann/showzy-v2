/**
 * Cancel / share + open-PDF (SHO-237 / SHO-306). Cancel is a UI confirm
 * after the options sheet hides; the action does not declare protocol
 * confirmation. Share returns the plaintext token once — this hook keeps
 * only `url` in memory and never logs it. Callbacks are ref-stable so
 * list row `memo` can bail.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { Linking, Share } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";

import { useApiClient } from "../../../api/api-provider";
import { useContractMutation } from "../../../api/contract-mutation";
import { describeQueryFailure } from "../../../api/errors";
import { useActiveCompany } from "../../../api/query-provider";
import type { DocumentsCopy } from "../../../i18n/documents";
import { getDocumentQueryOptions } from "../api/document-detail-query";
import {
  bindDocumentMutate,
  invalidateDocumentsAfterWrite,
  shareUrlFromResult,
  type DocumentWrite,
} from "../api/document-writes";
import { documentsCreateHref } from "../shared/document-hrefs";
import { isSafeHttpUrl } from "../shared/is-safe-http-url";
import {
  presentDocumentWritesBanner,
  shareMintFailureBanner,
} from "../shared/mutation-failure";

export type DocumentWriteTarget = {
  readonly id: string;
  readonly documentNumber: string;
  readonly status: "issued" | "cancelled";
};

export function useDocumentWrites(args: {
  readonly copy: DocumentsCopy;
  readonly canCreate: boolean;
  readonly canEdit: boolean;
}) {
  const apiClient = useApiClient();
  const apiRef = useRef(apiClient);
  apiRef.current = apiClient;
  const { activeCompanyId } = useActiveCompany();
  const queryClient = useQueryClient();
  const router = useRouter();
  const writeBusyRef = useRef(false);
  const [localBanner, setLocalBanner] = useState<string | null>(null);
  const argsRef = useRef(args);
  argsRef.current = args;
  const companyIdRef = useRef(activeCompanyId);
  companyIdRef.current = activeCompanyId;
  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;
  const routerRef = useRef(router);
  routerRef.current = router;

  const cancelMutation = useContractMutation(
    (input: Extract<DocumentWrite, { kind: "cancel" }>, options) => {
      const current = apiRef.current;
      if (current === null) {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      return bindDocumentMutate(current)(input, options);
    },
  );
  const shareMutation = useContractMutation(
    (input: Extract<DocumentWrite, { kind: "share" }>, options) => {
      const current = apiRef.current;
      if (current === null) {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      return bindDocumentMutate(current)(input, options);
    },
  );
  const cancelMutationRef = useRef(cancelMutation);
  cancelMutationRef.current = cancelMutation;
  const shareMutationRef = useRef(shareMutation);
  shareMutationRef.current = shareMutation;

  const banner = presentDocumentWritesBanner({
    localBanner,
    shareFailure: shareMutation.isError
      ? describeQueryFailure(shareMutation.error).kind
      : null,
    cancelFailure: cancelMutation.isError
      ? describeQueryFailure(cancelMutation.error).kind
      : null,
    mutationCopy: args.copy.mutation,
  });

  const afterWrite = useCallback(async (): Promise<void> => {
    await invalidateDocumentsAfterWrite({
      queryClient: queryClientRef.current,
      companyId: companyIdRef.current,
    });
    cancelMutationRef.current.reset();
    shareMutationRef.current.reset();
    setLocalBanner(null);
  }, []);

  const openCreate = useCallback(() => {
    if (!argsRef.current.canCreate) {
      return;
    }
    routerRef.current.push(documentsCreateHref());
  }, []);

  const goBack = useCallback(() => {
    routerRef.current.back();
  }, []);

  const setBanner = useCallback((message: string) => {
    cancelMutationRef.current.reset();
    shareMutationRef.current.reset();
    setLocalBanner(message);
  }, []);

  const cancel = useCallback(
    async (document: DocumentWriteTarget) => {
      if (!argsRef.current.canEdit || writeBusyRef.current) {
        return;
      }
      if (document.status !== "issued") {
        return;
      }
      writeBusyRef.current = true;
      setLocalBanner(null);
      try {
        await cancelMutationRef.current.submit({
          kind: "cancel",
          documentId: document.id,
        });
        await afterWrite();
      } catch {
        // Banner is derived from mutation.error.
      } finally {
        writeBusyRef.current = false;
      }
    },
    [afterWrite],
  );

  const mintShareUrl = useCallback(
    async (documentId: string): Promise<string | null> => {
      const current = argsRef.current;
      if (!current.canEdit || writeBusyRef.current) {
        return null;
      }
      writeBusyRef.current = true;
      setLocalBanner(null);
      try {
        const result = await shareMutationRef.current.submit({
          kind: "share",
          documentId,
        });
        const url = shareUrlFromResult(result);
        if (url === null) {
          setLocalBanner(current.copy.toast.shareFailed);
          return null;
        }
        shareMutationRef.current.reset();
        return url;
      } catch (error: unknown) {
        setLocalBanner(
          shareMintFailureBanner(
            describeQueryFailure(error).kind,
            current.copy.mutation,
            current.copy.toast.shareFailed,
          ),
        );
        return null;
      } finally {
        writeBusyRef.current = false;
      }
    },
    [],
  );

  const shareUrl = useCallback(async (url: string) => {
    try {
      await Share.share({ message: url });
    } catch {
      setLocalBanner(argsRef.current.copy.toast.shareFailed);
    }
  }, []);

  const copyUrl = useCallback(async (url: string): Promise<"ok" | "failed"> => {
    try {
      await Clipboard.setStringAsync(url);
      return "ok";
    } catch {
      return "failed";
    }
  }, []);

  const openPanelPdf = useCallback(
    async (documentId: string): Promise<void> => {
      const current = apiRef.current;
      const copy = argsRef.current.copy;
      if (current === null || companyIdRef.current === null) {
        setLocalBanner(copy.toast.pdfOpenFailed);
        return;
      }
      try {
        const view = await queryClientRef.current.fetchQuery(
          getDocumentQueryOptions({
            client: current,
            companyId: companyIdRef.current,
            documentId,
            getActiveCompany: () => apiRef.current?.getActiveCompany() ?? null,
          }),
        );
        if (view.generation.status === "failed") {
          setLocalBanner(copy.toast.pdfFailed);
          return;
        }
        if (view.pdfDownloadUrl === null) {
          setLocalBanner(copy.toast.pdfNotReady);
          return;
        }
        if (!isSafeHttpUrl(view.pdfDownloadUrl)) {
          setLocalBanner(copy.toast.pdfOpenFailed);
          return;
        }
        await Linking.openURL(view.pdfDownloadUrl);
      } catch {
        setLocalBanner(copy.toast.pdfOpenFailed);
      }
    },
    [],
  );

  const pending = cancelMutation.isPending || shareMutation.isPending;
  return useMemo(
    () => ({
      banner,
      pending,
      openCreate,
      goBack,
      setBanner,
      cancel,
      mintShareUrl,
      shareUrl,
      copyUrl,
      openPanelPdf,
    }),
    [
      banner,
      pending,
      openCreate,
      goBack,
      setBanner,
      cancel,
      mintShareUrl,
      shareUrl,
      copyUrl,
      openPanelPdf,
    ],
  );
}

export type DocumentWritesApi = ReturnType<typeof useDocumentWrites>;
