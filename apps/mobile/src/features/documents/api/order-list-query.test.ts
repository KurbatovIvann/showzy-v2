import { describe, expect, it } from "vitest";

import { contractQueryKey } from "../../../api/query-options";
import {
  DOCUMENT_ORDERS_LOOKUP_INPUT,
  LIST_ORDERS_ACTION,
  listDocumentOrdersInfiniteOptions,
} from "./order-list-query";

describe("listDocumentOrdersInfiniteOptions", () => {
  it("keys [actionName, companyId, input] for status all and keeps cursor out of the key", () => {
    const companyA = listDocumentOrdersInfiniteOptions({
      client: null,
      companyId: "company-a",
      getActiveCompany: () => "company-a",
    });
    const companyB = listDocumentOrdersInfiniteOptions({
      client: null,
      companyId: "company-b",
      getActiveCompany: () => "company-b",
    });
    expect(companyA.queryKey).toEqual(
      contractQueryKey(
        LIST_ORDERS_ACTION,
        "company-a",
        DOCUMENT_ORDERS_LOOKUP_INPUT,
      ),
    );
    expect(companyA.queryKey).not.toEqual(companyB.queryKey);
    expect(companyA.queryKey[1]).toBe("company-a");
    expect(JSON.stringify(companyA.queryKey)).not.toContain("cursor");
    expect(JSON.stringify(companyA.queryKey)).not.toContain("companyId");
    expect(DOCUMENT_ORDERS_LOOKUP_INPUT.status).toBe("all");
    expect(companyA.enabled).toBe(false);
  });
});
