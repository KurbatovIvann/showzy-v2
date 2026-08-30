import { describe, expect, it } from "vitest";

import { contractQueryKey } from "../../../api/query-options";
import {
  GET_DOCUMENT_ACTION,
  getDocumentQueryOptions,
} from "./document-detail-query";

const DOCUMENT_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";

describe("getDocumentQueryOptions", () => {
  it("keys [actionName, companyId, input] including the company selector", () => {
    const options = getDocumentQueryOptions({
      client: null,
      companyId: "company-a",
      documentId: DOCUMENT_ID,
      getActiveCompany: () => "company-a",
    });
    const otherCompany = getDocumentQueryOptions({
      client: null,
      companyId: "company-b",
      documentId: DOCUMENT_ID,
      getActiveCompany: () => "company-b",
    });
    expect(options.queryKey).toEqual(
      contractQueryKey(GET_DOCUMENT_ACTION, "company-a", {
        documentId: DOCUMENT_ID,
      }),
    );
    expect(options.queryKey[1]).toBe("company-a");
    expect(options.queryKey).not.toEqual(otherCompany.queryKey);
  });

  it("stays disabled without a client, company, or document id", () => {
    expect(
      getDocumentQueryOptions({
        client: null,
        companyId: "company-a",
        documentId: DOCUMENT_ID,
        getActiveCompany: () => "company-a",
      }).enabled,
    ).toBe(false);
    expect(
      getDocumentQueryOptions({
        client: null,
        companyId: "company-a",
        documentId: null,
        getActiveCompany: () => "company-a",
      }).enabled,
    ).toBe(false);
  });
});
