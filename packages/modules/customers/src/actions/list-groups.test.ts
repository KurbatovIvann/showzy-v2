import { describe, expect, it } from "vitest";

import { LIST_GROUPS_SEARCH_MAX as VALIDATION_SEARCH_MAX } from "@showzy/validation/customers";

import {
  LIST_GROUPS_CURSOR_MAX,
  LIST_GROUPS_DEFAULT_LIMIT,
  LIST_GROUPS_MAX_LIMIT,
  LIST_GROUPS_SEARCH_MAX,
  formatListGroupsCursor,
  listGroupsContract,
  parseListGroupsCursor,
} from "./list-groups.contract.js";

describe("customers.listGroups contract", () => {
  it("is a staff client read with customers:view", () => {
    expect(listGroupsContract.name).toBe("customers.listGroups");
    expect(listGroupsContract.principal).toBe("staff");
    expect(listGroupsContract.transport).toBe("client");
    expect(listGroupsContract.risk).toBe("read");
    expect(listGroupsContract.permissions).toEqual(["customers:view"]);
    expect(listGroupsContract.aiExposure).toBe("exposed");
    expect(listGroupsContract.audit).toBe(false);
    expect(listGroupsContract.idempotent).toBe(false);
    expect(listGroupsContract.emits).toEqual([]);
    expect(listGroupsContract.timeout).toBe(5_000);
    expect(listGroupsContract.rateLimit).toBeUndefined();
    expect(LIST_GROUPS_DEFAULT_LIMIT).toBe(20);
    expect(LIST_GROUPS_MAX_LIMIT).toBe(50);
    expect(LIST_GROUPS_SEARCH_MAX).toBe(VALIDATION_SEARCH_MAX);
    expect(LIST_GROUPS_SEARCH_MAX).toBe(100);
    expect(LIST_GROUPS_CURSOR_MAX).toBe(200);
  });

  it("defaults limit to 20 and rejects a malformed cursor, oversized limit, and over-max search", () => {
    expect(listGroupsContract.input.parse({}).limit).toBe(
      LIST_GROUPS_DEFAULT_LIMIT,
    );
    expect(listGroupsContract.input.safeParse({ cursor: "nope" }).success).toBe(
      false,
    );
    expect(
      listGroupsContract.input.safeParse({
        limit: LIST_GROUPS_MAX_LIMIT + 1,
      }).success,
    ).toBe(false);
    expect(listGroupsContract.input.safeParse({ limit: 0 }).success).toBe(
      false,
    );
    expect(
      listGroupsContract.input.safeParse({
        search: "x".repeat(LIST_GROUPS_SEARCH_MAX + 1),
      }).success,
    ).toBe(false);
    expect(listGroupsContract.input.safeParse({ search: "   " }).success).toBe(
      false,
    );
    expect(parseListGroupsCursor("nope")).toBeUndefined();
    expect(
      parseListGroupsCursor(formatListGroupsCursor(0, "not-a-uuid", "VIP")),
    ).toBeUndefined();
  });

  it("round-trips a cursor whose name contains a pipe", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const cursor = formatListGroupsCursor(2, id, "C|Special");
    expect(parseListGroupsCursor(cursor)).toEqual({
      sortOrder: 2,
      id,
      name: "C|Special",
    });
  });
});
