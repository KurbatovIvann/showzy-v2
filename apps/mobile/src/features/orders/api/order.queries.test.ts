import { describe, expect, it } from "vitest";

import { contractQueryKey } from "../../../api/query-options";
import { LIST_ORDERS_ACTION, listOrdersInfiniteOptions } from "./order.queries";

describe("listOrdersInfiniteOptions", () => {
  it("keys [actionName, companyId, input] and keeps cursor out of the key", () => {
    const all = listOrdersInfiniteOptions({
      client: null,
      companyId: "company-a",
      input: { kind: "page.summary" },
      getActiveCompany: () => "company-a",
    });
    const canceled = listOrdersInfiniteOptions({
      client: null,
      companyId: "company-a",
      input: {
        kind: "page.summary",
        filter: { statuses: ["canceled"] },
      },
      getActiveCompany: () => "company-a",
    });
    const otherCompany = listOrdersInfiniteOptions({
      client: null,
      companyId: "company-b",
      input: { kind: "page.summary" },
      getActiveCompany: () => "company-b",
    });
    const searched = listOrdersInfiniteOptions({
      client: null,
      companyId: "company-a",
      input: {
        kind: "page.summary",
        filter: { query: "1042" },
      },
      getActiveCompany: () => "company-a",
    });
    expect(all.queryKey).toEqual(
      contractQueryKey(LIST_ORDERS_ACTION, "company-a", {
        kind: "page.summary",
      }),
    );
    expect(canceled.queryKey).toEqual(
      contractQueryKey(LIST_ORDERS_ACTION, "company-a", {
        kind: "page.summary",
        filter: { statuses: ["canceled"] },
      }),
    );
    expect(searched.queryKey).toEqual(
      contractQueryKey(LIST_ORDERS_ACTION, "company-a", {
        kind: "page.summary",
        filter: { query: "1042" },
      }),
    );
    expect(all.queryKey).not.toEqual(canceled.queryKey);
    expect(all.queryKey).not.toEqual(otherCompany.queryKey);
    expect(all.queryKey).not.toEqual(searched.queryKey);
    expect(all.queryKey[1]).toBe("company-a");
    expect(searched.queryKey[1]).toBe("company-a");
    expect(JSON.stringify(searched.queryKey)).toContain("1042");
    expect(JSON.stringify(all.queryKey)).not.toContain("cursor");
    expect(all.enabled).toBe(false);
  });
});
