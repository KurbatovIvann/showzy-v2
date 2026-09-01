import { describe, expect, it } from "vitest";

import { LIST_CUSTOMERS_SEARCH_MAX } from "@showzy/validation/customers";

import {
  LIST_MATCHING_IDS_MAX,
  LIST_MATCHING_IDS_QUERY_MAX,
  listMatchingIdsContract,
} from "./list-matching-ids.contract.js";

describe("customers.listMatchingIds contract", () => {
  it("is a staff internal read with customers:view", () => {
    expect(listMatchingIdsContract.name).toBe("customers.listMatchingIds");
    expect(listMatchingIdsContract.principal).toBe("staff");
    expect(listMatchingIdsContract.transport).toBe("internal");
    expect(listMatchingIdsContract.risk).toBe("read");
    expect(listMatchingIdsContract.permissions).toEqual(["customers:view"]);
    expect(listMatchingIdsContract.aiExposure).toBe("internal");
    expect(listMatchingIdsContract.audit).toBe(false);
    expect(listMatchingIdsContract.idempotent).toBe(false);
    expect(listMatchingIdsContract.emits).toEqual([]);
    expect(listMatchingIdsContract.timeout).toBe(5_000);
    expect(LIST_MATCHING_IDS_MAX).toBe(500);
    expect(LIST_MATCHING_IDS_QUERY_MAX).toBe(LIST_CUSTOMERS_SEARCH_MAX);
    expect(LIST_MATCHING_IDS_QUERY_MAX).toBe(100);
  });

  it("requires a trimmed query and rejects extras", () => {
    expect(listMatchingIdsContract.input.parse({ query: "  Alpha  " })).toEqual(
      {
        query: "Alpha",
      },
    );
    expect(listMatchingIdsContract.input.safeParse({}).success).toBe(false);
    expect(
      listMatchingIdsContract.input.safeParse({ query: "   " }).success,
    ).toBe(false);
    expect(
      listMatchingIdsContract.input.safeParse({
        query: "x".repeat(LIST_MATCHING_IDS_QUERY_MAX + 1),
      }).success,
    ).toBe(false);
    expect(
      listMatchingIdsContract.input.safeParse({
        query: "Alpha",
        status: "all",
      }).success,
    ).toBe(false);
    expect(
      listMatchingIdsContract.input.safeParse({
        query: "Alpha",
        companyId: "11111111-1111-4111-8111-111111111111",
      }).success,
    ).toBe(false);
  });
});
