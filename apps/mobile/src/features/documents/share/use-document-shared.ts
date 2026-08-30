import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Linking } from "react-native";

import { useApiClient } from "../../../api/api-provider";
import { describeQueryFailure } from "../../../api/errors";
import { useAuthSession } from "../../../auth/session-provider";
import { documentsCopy } from "../../../i18n/documents";
import { detectLocale } from "../../../i18n/locale";
import { getSharedDocumentQueryOptions } from "../api/document-shared-query";
import { shareTokenFromParam } from "../shared/document-token";
import { classifyDocumentSharedLoad } from "./document-shared-load";

export type DocumentSharedModel = ReturnType<typeof useDocumentShared>;

export function useDocumentShared() {
  const copy = documentsCopy(detectLocale());
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = shareTokenFromParam(params.token);
  const apiClient = useApiClient();
  const auth = useAuthSession();

  const query = useQuery(
    getSharedDocumentQueryOptions({
      client: apiClient,
      token,
    }),
  );

  const state = classifyDocumentSharedLoad({
    token,
    clientReady: apiClient !== null,
    authLoading: auth.status === "loading",
    status: query.status,
    failureKind: query.isError ? describeQueryFailure(query.error).kind : null,
    pdfDownloadUrl: query.data?.pdfDownloadUrl ?? null,
    signedDownloadUrl: query.data?.signedDownloadUrl ?? null,
  });

  return {
    copy: copy.shared,
    state,
    retry: () => {
      void query.refetch();
    },
    goBack: () => {
      router.back();
    },
    download: () => {
      if (state.kind !== "ready" || state.downloadUrl === null) {
        return;
      }
      void Linking.openURL(state.downloadUrl);
    },
    downloadSigned: () => {
      if (state.kind !== "ready" || state.signedDownloadUrl === null) {
        return;
      }
      void Linking.openURL(state.signedDownloadUrl);
    },
  };
}
