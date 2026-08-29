/**
 * Cancel / share + open-PDF (SHO-237). Cancel is a UI confirm after the
 * options sheet hides; the action does not declare protocol confirmation.
 * Share returns the plaintext token once — this hook keeps only `url` in
 * memory and never logs it.
 */
import { useRef, useState } from "react";
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
import {
  documentsWriteBanner,
  mapDocumentsWriteFailure,
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

  const cancelFailure = cancelMutation.isError
    ? describeQueryFailure(cancelMutation.error).kind
    : null;
  const shareFailure = shareMutation.isError
    ? describeQueryFailure(shareMutation.error).kind
    : null;
  const banner =
    localBanner ??
    documentsWriteBanner(
      mapDocumentsWriteFailure(shareFailure),
      args.copy.mutation,
    ) ??
    documentsWriteBanner(
      mapDocumentsWriteFailure(cancelFailure),
      args.copy.mutation,
    );

  async function afterWrite(): Promise<void> {
    await invalidateDocumentsAfterWrite({
      queryClient,
      companyId: activeCompanyId,
    });
    cancelMutation.reset();
    shareMutation.reset();
    setLocalBanner(null);
  }

  async function mintShareUrl(documentId: string): Promise<string | null> {
    if (!args.canEdit || writeBusyRef.current) {
      return null;
    }
    writeBusyRef.current = true;
    setLocalBanner(null);
    try {
      const result = await shareMutation.submit({
        kind: "share",
        documentId,
      });
      const url = shareUrlFromResult(result);
      if (url === null) {
        setLocalBanner(args.copy.toast.shareFailed);
        return null;
      }
      shareMutation.reset();
      return url;
    } catch {
      return null;
    } finally {
      writeBusyRef.current = false;
    }
  }

  async function openPanelPdf(documentId: string): Promise<void> {
    const current = apiRef.current;
    if (current === null || activeCompanyId === null) {
      setLocalBanner(args.copy.toast.pdfOpenFailed);
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
      if (view.generation.status === "failed") {
        setLocalBanner(args.copy.toast.pdfFailed);
        return;
      }
      if (view.pdfDownloadUrl === null) {
        setLocalBanner(args.copy.toast.pdfNotReady);
        return;
      }
      await Linking.openURL(view.pdfDownloadUrl);
    } catch {
      setLocalBanner(args.copy.toast.pdfOpenFailed);
    }
  }

  return {
    banner,
    pending: cancelMutation.isPending || shareMutation.isPending,
    openCreate: () => {
      if (!args.canCreate) {
        return;
      }
      router.push(documentsCreateHref());
    },
    goBack: () => {
      router.back();
    },
    setBanner: (message: string) => {
      cancelMutation.reset();
      shareMutation.reset();
      setLocalBanner(message);
    },
    cancel: async (document: DocumentWriteTarget) => {
      if (!args.canEdit || writeBusyRef.current) {
        return;
      }
      if (document.status !== "issued") {
        return;
      }
      writeBusyRef.current = true;
      setLocalBanner(null);
      try {
        await cancelMutation.submit({
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
    mintShareUrl,
    shareUrl: async (url: string) => {
      try {
        await Share.share({ message: url });
      } catch {
        setLocalBanner(args.copy.toast.shareFailed);
      }
    },
    copyUrl: async (url: string): Promise<"ok" | "failed"> => {
      try {
        await Clipboard.setStringAsync(url);
        return "ok";
      } catch {
        return "failed";
      }
    },
    openPanelPdf,
  };
}
