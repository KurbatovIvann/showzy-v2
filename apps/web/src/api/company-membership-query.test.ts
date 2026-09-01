import { describe, expect, it } from "vitest";

import { LIST_MINE_ACTION, listMineQueryKey } from "./company-membership-query";
import { NULL_COMPANY_QUERY_SCOPE } from "./query-options";

describe("listMine query key (SHO-313)", () => {
  it("is [actionName, null-company, input]", () => {
    expect(LIST_MINE_ACTION).toBe("companies.listMine");
    expect(listMineQueryKey()).toEqual([
      "companies.listMine",
      NULL_COMPANY_QUERY_SCOPE,
      {},
    ]);
  });
});
