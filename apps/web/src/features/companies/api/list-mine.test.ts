import { describe, expect, it } from "vitest";

import { NULL_COMPANY_QUERY_SCOPE } from "../../../api/query-options";
import { LIST_MINE_ACTION, listMineQueryKey } from "./list-mine";

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
