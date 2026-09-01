import { describe, expect, it } from "vitest";

import { contractQueryKey } from "../../../api/query-options";
import { DOCUMENT_LOOKUP_PAGE_SIZE } from "../shared/document-caps";
import {
  DOCUMENT_ORDERS_LOOKUP_INPUT,
  LIST_ORDERS_ACTION,
  listDocumentOrdersInfiniteOptions,
} from "./order-list-query";

describe("listDocumentOrdersInfiniteOptions", () => {
  it("keys [actionName, companyId, input] for confirmed orders and keeps cursor out of the key", () => {
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
    expect(DOCUMENT_ORDERS_LOOKUP_INPUT).toEqual({
      kind: "page.summary",
      filter: { statuses: ["confirmed"] },
      limit: DOCUMENT_LOOKUP_PAGE_SIZE,
    });
    expect(DOCUMENT_ORDERS_LOOKUP_INPUT.filter.statuses).not.toContain(
      "canceled",
    );
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
    expect(companyA.enabled).toBe(false);
  });
});
