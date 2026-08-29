import { describe, expect, it } from "vitest";

import type { MutationCallOptions } from "@showzy/contract";

import { createContractMutationController } from "../../../api/contract-mutation";
import { createShowzyQueryClient } from "../../../api/query-client";
import { contractQueryKey } from "../../../api/query-options";
import { documentsWriteInvalidationKeys } from "./document-cache";
import { GET_DOCUMENT_ACTION } from "./document-detail-query";
import { LIST_DOCUMENTS_ACTION } from "./document.queries";
import {
  bindDocumentMutate,
  invalidateDocumentsAfterWrite,
  shareUrlFromResult,
  type DocumentWrite,
} from "./document-writes";

const DOCUMENT_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";
const ORDER_ID = "1f0e2d5c-4a1b-4c3d-9e8f-102938475602";

describe("bindDocumentMutate", () => {
  it("routes cancel and share to the matching action with the attempt options", async () => {
    const calls: Array<{
      readonly method: string;
      readonly documentId: string;
      readonly key: string;
    }> = [];
    const mutate = bindDocumentMutate({
      client: {
        documents: {
          cancel: (input, options: MutationCallOptions) => {
            calls.push({
              method: "cancel",
              documentId: input.documentId,
              key: options.context.idempotencyKey,
            });
            return Promise.resolve({
              documentId: input.documentId,
              orderId: ORDER_ID,
              status: "cancelled",
            });
          },
          share: (input, options: MutationCallOptions) => {
            calls.push({
              method: "share",
              documentId: input.documentId,
              key: options.context.idempotencyKey,
            });
            return Promise.resolve({
              url: "https://example.test/d/token-once",
              token: "token-once",
            });
          },
        },
      },
    });
    const cancel = createContractMutationController<DocumentWrite, unknown>({
      mutate,
    });
    const share = createContractMutationController<DocumentWrite, unknown>({
      mutate,
    });

    await cancel.submit({ kind: "cancel", documentId: DOCUMENT_ID });
    const shared = await share.submit({
      kind: "share",
      documentId: DOCUMENT_ID,
    });

    expect(calls).toHaveLength(2);
    expect(calls[0]?.method).toBe("cancel");
    expect(calls[1]?.method).toBe("share");
    expect(calls[0]?.documentId).toBe(DOCUMENT_ID);
    expect(calls[0]?.key).not.toEqual(calls[1]?.key);
    expect(shareUrlFromResult(shared)).toBe(
      "https://example.test/d/token-once",
    );
  });
});

describe("shareUrlFromResult", () => {
  it("returns only the url and ignores a missing token field", () => {
    expect(
      shareUrlFromResult({ url: "https://example.test/d/abc", token: "abc" }),
    ).toBe("https://example.test/d/abc");
    expect(shareUrlFromResult({ url: "" })).toBeNull();
    expect(shareUrlFromResult(null)).toBeNull();
    expect(shareUrlFromResult({ token: "abc" })).toBeNull();
  });
});

describe("documentsWriteInvalidationKeys", () => {
  it("targets documents.get and documents.list for the active company only", () => {
    expect(documentsWriteInvalidationKeys("company-a")).toEqual([
      [GET_DOCUMENT_ACTION, "company-a"],
      [LIST_DOCUMENTS_ACTION, "company-a"],
    ]);
  });

  it("invalidates after a successful write without touching other companies", async () => {
    const queryClient = createShowzyQueryClient();
    const getKey = contractQueryKey(GET_DOCUMENT_ACTION, "company-a", {
      documentId: DOCUMENT_ID,
    });
    const listKey = contractQueryKey(LIST_DOCUMENTS_ACTION, "company-a", {
      type: "all",
    });
    const otherKey = contractQueryKey(GET_DOCUMENT_ACTION, "company-b", {
      documentId: DOCUMENT_ID,
    });
    queryClient.setQueryData(getKey, { documentId: DOCUMENT_ID });
    queryClient.setQueryData(listKey, { items: [] });
    queryClient.setQueryData(otherKey, { documentId: DOCUMENT_ID });

    await invalidateDocumentsAfterWrite({
      queryClient,
      companyId: "company-a",
    });

    expect(queryClient.getQueryState(getKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(otherKey)?.isInvalidated).toBe(false);
  });
});
