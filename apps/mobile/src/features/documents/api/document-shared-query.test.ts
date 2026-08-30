import { describe, expect, it } from "vitest";

import {
  NULL_COMPANY_QUERY_SCOPE,
  contractQueryKey,
} from "../../../api/query-options";
import {
  GET_SHARED_DOCUMENT_ACTION,
  getSharedDocumentQueryOptions,
} from "./document-shared-query";

const TOKEN = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ012";

describe("getSharedDocumentQueryOptions", () => {
  it("keys [actionName, null-company, { token }] and does not send companyId", () => {
    const options = getSharedDocumentQueryOptions({
      client: null,
      token: TOKEN,
    });
    expect(options.queryKey).toEqual(
      contractQueryKey(GET_SHARED_DOCUMENT_ACTION, null, { token: TOKEN }),
    );
    expect(options.queryKey[1]).toBe(NULL_COMPANY_QUERY_SCOPE);
    expect(JSON.stringify(options.queryKey)).not.toContain("companyId");
    expect(options.enabled).toBe(false);
  });

  it("stays disabled without a token and enables only with a client", () => {
    expect(
      getSharedDocumentQueryOptions({
        client: null,
        token: null,
      }).enabled,
    ).toBe(false);
  });
});
