/**
 * Cancel and share writes (SHO-237). Distinct actions so a failed cancel
 * does not retry as share. Cache invalidation is post-success only —
 * never optimistic. Share returns the plaintext token once; callers must
 * not log it or the signed URL.
 */
import type { MutationCallOptions } from "@showzy/contract";
import type { QueryClient } from "@tanstack/react-query";

import { documentsWriteInvalidationKeys } from "./document-cache";

export type DocumentWrite =
  | { readonly kind: "cancel"; readonly documentId: string }
  | { readonly kind: "share"; readonly documentId: string };

export type DocumentWriteTransport = {
  readonly client: {
    readonly documents: {
      readonly cancel: (
        input: { documentId: string },
        options: MutationCallOptions,
      ) => Promise<{
        documentId: string;
        orderId: string;
        status: "cancelled";
      }>;
      readonly share: (
        input: { documentId: string },
        options: MutationCallOptions,
      ) => Promise<{
        readonly url: string;
        readonly token: string;
      }>;
    };
  };
};

export function bindDocumentMutate(client: DocumentWriteTransport) {
  return (
    input: DocumentWrite,
    options: MutationCallOptions,
  ): Promise<unknown> => {
    switch (input.kind) {
      case "cancel":
        return client.client.documents.cancel(
          { documentId: input.documentId },
          options,
        );
      case "share":
        return client.client.documents.share(
          { documentId: input.documentId },
          options,
        );
    }
  };
}

/** Pull the handover URL only. Do not retain or log `token`. */
export function shareUrlFromResult(result: unknown): string | null {
  if (
    typeof result !== "object" ||
    result === null ||
    !("url" in result) ||
    typeof result.url !== "string" ||
    result.url.length === 0
  ) {
    return null;
  }
  return result.url;
}

export async function invalidateDocumentsAfterWrite(args: {
  readonly queryClient: QueryClient;
  readonly companyId: string | null;
}): Promise<void> {
  if (args.companyId === null) {
    return;
  }
  await Promise.all(
    documentsWriteInvalidationKeys(args.companyId).map((queryKey) =>
      args.queryClient.invalidateQueries({ queryKey }),
    ),
  );
}
