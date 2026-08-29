import { describe, expect, it } from "vitest";

import {
  LIST_ORDERS_CURSOR_MAX,
  LIST_ORDERS_DEFAULT_LIMIT,
  LIST_ORDERS_MAX_LIMIT,
  LIST_ORDERS_QUERY_MAX,
  listOrdersContract,
  listOrdersInputSchema,
  parseListOrdersCursor,
} from "./list.contract.js";

describe("orders.list contract", () => {
  it("is a staff client read with orders:view", () => {
    expect(listOrdersContract.name).toBe("orders.list");
    expect(listOrdersContract.principal).toBe("staff");
    expect(listOrdersContract.transport).toBe("client");
    expect(listOrdersContract.risk).toBe("read");
    expect(listOrdersContract.permissions).toEqual(["orders:view"]);
    expect(listOrdersContract.aiExposure).toBe("exposed");
    expect(listOrdersContract.audit).toBe(false);
    expect(listOrdersContract.idempotent).toBe(false);
    expect(listOrdersContract.emits).toEqual([]);
    expect(listOrdersContract.timeout).toBe(10_000);
    expect(LIST_ORDERS_DEFAULT_LIMIT).toBe(20);
    expect(LIST_ORDERS_MAX_LIMIT).toBe(50);
    expect(LIST_ORDERS_CURSOR_MAX).toBe(80);
    expect(LIST_ORDERS_QUERY_MAX).toBe(100);
  });

  it("defaults status to all and rejects a malformed cursor", () => {
    expect(listOrdersContract.input.parse({}).status).toBe("all");
    expect(listOrdersContract.input.parse({}).limit).toBe(
      LIST_ORDERS_DEFAULT_LIMIT,
    );
    expect(listOrdersContract.input.safeParse({ cursor: "nope" }).success).toBe(
      false,
    );
    expect(
      listOrdersContract.input.safeParse({
        limit: LIST_ORDERS_MAX_LIMIT + 1,
      }).success,
    ).toBe(false);
    expect(listOrdersContract.input.safeParse({ limit: 0 }).success).toBe(
      false,
    );
    expect(
      listOrdersContract.input.safeParse({ status: "in_progress" }).success,
    ).toBe(false);
    expect(Object.keys(listOrdersInputSchema.shape).toSorted()).toEqual([
      "cursor",
      "limit",
      "query",
      "status",
    ]);
    expect(
      listOrdersContract.input.safeParse({
        query: "x".repeat(LIST_ORDERS_QUERY_MAX + 1),
      }).success,
    ).toBe(false);
    expect(listOrdersContract.input.safeParse({ query: "   " }).success).toBe(
      false,
    );
    expect(parseListOrdersCursor("nope")).toBeUndefined();
  });
});
