/**
 * High-risk `documents.requestSign` HITL (SHO-260). Protocol confirmation
 * is applied by `submitWithProtocolConfirmation` after the UI confirm —
 * copy `pricing/api/price-list-delete.ts`. Confirmation does not replace
 * key possession.
 */
import type { MutationCallOptions } from "@showzy/contract";

export type DocumentRequestSignTransport = {
  readonly client: {
    readonly documents: {
      readonly requestSign: (
        input: { documentId: string },
        options: MutationCallOptions,
      ) => Promise<{ documentId: string }>;
    };
  };
};

export function bindDocumentRequestSignMutate(
  client: DocumentRequestSignTransport,
) {
  return (
    input: { documentId: string },
    options: MutationCallOptions,
  ): Promise<{ documentId: string }> => {
    return client.client.documents.requestSign(input, options);
  };
}
