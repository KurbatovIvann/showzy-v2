/**
 * Post-create handover I/O (SHO-238). Composer stays RHF + save + leave.
 * Close replace-navigates with `waitForSheetHidden` (Android has no
 * Modal.onDismiss). `form/` must not import `list/`.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Linking, Share } from "react-native";
import * as Clipboard from "expo-clipboard";

import { useApiClient } from "../../../api/api-provider";
import { useContractMutation } from "../../../api/contract-mutation";
import { useActiveCompany } from "../../../api/query-provider";
import { useSheetHiddenWaiter } from "../../../hooks/use-sheet-hidden-waiter";
import type { DocumentsCopy } from "../../../i18n/documents";
import { getDocumentQueryOptions } from "../api/document-detail-query";
import {
  bindDocumentMutate,
  shareUrlFromResult,
  type DocumentWrite,
} from "../api/document-writes";
import { documentsHref } from "../shared/document-hrefs";
import { isSafeHttpUrl } from "../shared/is-safe-http-url";
import {
  documentHandoverHidden,
  hideDocumentHandover,
  IDLE_DOCUMENT_HANDOVER,
  openDocumentHandover,
  type DocumentHandoverChrome,
} from "../share/document-handover-chrome";
import { waitThenReplaceAfterCreateHandover } from "./document-form-handover";
import type { CreateFromOrderResult } from "./document-form-plan";

export function useDocumentFormHandover(args: {
  readonly copy: DocumentsCopy;
  readonly canEdit: boolean;
}) {
  const router = useRouter();
  const apiClient = useApiClient();
  const apiRef = useRef(apiClient);
  apiRef.current = apiClient;
  const { activeCompanyId } = useActiveCompany();
  const queryClient = useQueryClient();
  const handoverHidden = useSheetHiddenWaiter();
  const [handoverChrome, setHandoverChrome] = useState<DocumentHandoverChrome>(
    IDLE_DOCUMENT_HANDOVER,
  );
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [created, setCreated] = useState(false);
  const createdRef = useRef(false);
  const createdDocumentIdRef = useRef<string | null>(null);

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
    if (!args.canEdit) {
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
      if (!isSafeHttpUrl(view.pdfDownloadUrl)) {
        return;
      }
      await Linking.openURL(view.pdfDownloadUrl);
    } catch {
      // Print is best-effort after create; list toasts cover the options path.
    }
  }

  return {
    created,
    pending: shareMutation.isPending,
    visible: handoverChrome.visible,
    url: handoverChrome.url,
    title: handoverChrome.documentNumber ?? args.copy.handover.title,
    copied,
    copyFailed,
    afterCreate: async (result: CreateFromOrderResult): Promise<void> => {
      createdRef.current = true;
      setCreated(true);
      createdDocumentIdRef.current = result.documentId;
      if (!args.canEdit) {
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
    closeHandover: () => {
      void waitThenReplaceAfterCreateHandover({
        created: createdRef.current,
        waitHidden: handoverHidden.wait,
        hide: () => {
          setHandoverChrome(hideDocumentHandover);
        },
        replace: () => {
          router.replace(documentsHref());
        },
      });
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
  };
}
