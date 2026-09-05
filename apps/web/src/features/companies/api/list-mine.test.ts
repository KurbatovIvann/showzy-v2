import { describe, expect, it } from "vitest";

import { createWebQueryClient } from "../../../api/query-client";
import { NULL_COMPANY_QUERY_SCOPE } from "../../../api/query-options";
import {
  LIST_MINE_ACTION,
  listMineQueryKey,
  refreshListMineAfterAuthorizationDenied,
} from "./list-mine";

describe("listMine query key (SHO-330)", () => {
  it("is [actionName, null-company, sessionUserId, input]", () => {
    expect(LIST_MINE_ACTION).toBe("companies.listMine");
    expect(listMineQueryKey("user-1")).toEqual([
      "companies.listMine",
      NULL_COMPANY_QUERY_SCOPE,
      "user-1",
      {},
    ]);
    expect(listMineQueryKey("user-1")[2]).toBe("user-1");
  });
});

describe("refreshListMineAfterAuthorizationDenied (SHO-438)", () => {
  it("invalidates listMine on PERMISSION_DENIED and ignores other failures", () => {
    const queryClient = createWebQueryClient({ retryQueries: false });
    const key = listMineQueryKey("user-1");
    queryClient.setQueryData(key, { memberships: [] });
    refreshListMineAfterAuthorizationDenied({
      queryClient,
      sessionUserId: "user-1",
      error: new Error("network"),
    });
    expect(queryClient.getQueryState(key)?.isInvalidated).toBe(false);
    refreshListMineAfterAuthorizationDenied({
      queryClient,
      sessionUserId: null,
      error: {
        code: "PERMISSION_DENIED",
        status: 403,
        message: "denied",
      },
    });
    expect(queryClient.getQueryState(key)?.isInvalidated).toBe(false);
    refreshListMineAfterAuthorizationDenied({
      queryClient,
      sessionUserId: "user-1",
      error: {
        code: "PERMISSION_DENIED",
        status: 403,
        message: "denied",
      },
    });
    expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
    queryClient.clear();
  });

  it("does not invalidate another account's listMine row", () => {
    const queryClient = createWebQueryClient({ retryQueries: false });
    const ownKey = listMineQueryKey("user-1");
    const otherKey = listMineQueryKey("user-2");
    queryClient.setQueryData(ownKey, { memberships: [] });
    queryClient.setQueryData(otherKey, { memberships: [] });
    refreshListMineAfterAuthorizationDenied({
      queryClient,
      sessionUserId: "user-1",
      error: {
        code: "PERMISSION_DENIED",
        status: 403,
        message: "denied",
      },
    });
    expect(queryClient.getQueryState(ownKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(otherKey)?.isInvalidated).toBe(false);
    queryClient.clear();
  });
});
