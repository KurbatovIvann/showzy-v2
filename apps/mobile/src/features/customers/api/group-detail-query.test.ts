import { describe, expect, it } from "vitest";

import { contractQueryKey } from "../../../api/query-options";
import { GET_GROUP_ACTION, getGroupQueryOptions } from "./group-detail-query";

const GROUP_ID = "11111111-1111-4111-8111-111111111111";

describe("getGroupQueryOptions", () => {
  it("keys by action, company selector, and group id", () => {
    const options = getGroupQueryOptions({
      client: null,
      companyId: "company-a",
      groupId: GROUP_ID,
      getActiveCompany: () => "company-a",
    });
    expect(options.queryKey).toEqual(
      contractQueryKey(GET_GROUP_ACTION, "company-a", {
        id: GROUP_ID,
      }),
    );
  });

  it("stays disabled without a client, company, or valid group id", () => {
    expect(
      getGroupQueryOptions({
        client: null,
        companyId: "company-a",
        groupId: GROUP_ID,
        getActiveCompany: () => "company-a",
      }).enabled,
    ).toBe(false);
    expect(
      getGroupQueryOptions({
        client: null,
        companyId: "company-a",
        groupId: null,
        getActiveCompany: () => "company-a",
      }).enabled,
    ).toBe(false);
  });
});
