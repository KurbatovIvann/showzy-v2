import { describe, expect, it } from "vitest";

import { createShowzyClient } from "./client";
import {
  bindActiveCompanyQueryIsolation,
  createWebQueryClient,
  isolateCacheOnSessionLoss,
} from "./query-client";
import {
  accountContractQueryKey,
  contractQueryKey,
  NULL_COMPANY_QUERY_SCOPE,
} from "./query-options";

describe("query cache isolation", () => {
  it("clears tenant rows but preserves null-company rows on setActiveCompany", () => {
    const queryClient = createWebQueryClient({ retryQueries: false });
    const created = createShowzyClient({ baseUrl: "http://panel.test" });
    bindActiveCompanyQueryIsolation(created, queryClient);

    const companyAKey = contractQueryKey("companies.get", "company-a", {});
    const membershipsKey = accountContractQueryKey(
      "companies.listMine",
      "user-a",
      {},
    );
    queryClient.setQueryData(companyAKey, { id: "company-a" });
    queryClient.setQueryData(membershipsKey, { memberships: [] });

    created.setActiveCompany("company-b");
    expect(queryClient.getQueryData(companyAKey)).toBeUndefined();
    expect(queryClient.getQueryData(membershipsKey)).toEqual({
      memberships: [],
    });
    expect(membershipsKey[1]).toBe(NULL_COMPANY_QUERY_SCOPE);
  });

  it("clears leftover rows and resets the selector on session loss", () => {
    const queryClient = createWebQueryClient({ retryQueries: false });
    const created = createShowzyClient({
      baseUrl: "http://panel.test",
      initialCompanyId: "company-a",
    });
    bindActiveCompanyQueryIsolation(created, queryClient);
    const priceKey = contractQueryKey("companies.get", "company-a", {});
    const membershipsKey = accountContractQueryKey(
      "companies.listMine",
      "user-a",
      {},
    );
    queryClient.setQueryData(priceKey, { id: "company-a" });
    queryClient.setQueryData(membershipsKey, { memberships: [] });

    isolateCacheOnSessionLoss("loading", "anonymous", {
      client: created,
      queryClient,
    });
    expect(queryClient.getQueryData(priceKey)).toEqual({ id: "company-a" });

    isolateCacheOnSessionLoss("authenticated", "anonymous", {
      client: created,
      queryClient,
    });
    expect(created.getActiveCompany()).toBeNull();
    expect(queryClient.getQueryData(priceKey)).toBeUndefined();
    expect(queryClient.getQueryData(membershipsKey)).toBeUndefined();
  });
});
