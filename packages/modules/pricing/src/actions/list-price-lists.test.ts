import { describe, expect, it } from "vitest";

import {
  LIST_PRICE_LISTS_CURSOR_MAX,
  LIST_PRICE_LISTS_DEFAULT_LIMIT,
  LIST_PRICE_LISTS_MAX_LIMIT,
  PRICE_LIST_NAME_MAX,
  formatListPriceListsCursor,
  listPriceListsContract,
  parseListPriceListsCursor,
} from "./list-price-lists.contract.js";

describe("pricing.listPriceLists contract", () => {
  it("is a staff client read with pricing:view", () => {
    expect(listPriceListsContract.name).toBe("pricing.listPriceLists");
    expect(listPriceListsContract.principal).toBe("staff");
    expect(listPriceListsContract.transport).toBe("client");
    expect(listPriceListsContract.risk).toBe("read");
    expect(listPriceListsContract.permissions).toEqual(["pricing:view"]);
    expect(listPriceListsContract.aiExposure).toBe("exposed");
    expect(listPriceListsContract.audit).toBe(false);
    expect(listPriceListsContract.idempotent).toBe(false);
    expect(listPriceListsContract.emits).toEqual([]);
    expect(listPriceListsContract.timeout).toBe(5_000);
    expect(LIST_PRICE_LISTS_DEFAULT_LIMIT).toBe(20);
    expect(LIST_PRICE_LISTS_MAX_LIMIT).toBe(50);
    expect(PRICE_LIST_NAME_MAX).toBe(120);
    expect(LIST_PRICE_LISTS_CURSOR_MAX).toBe(200);
  });

  it("defaults limit to 20 and rejects a malformed cursor or oversized limit", () => {
    expect(listPriceListsContract.input.parse({}).limit).toBe(
      LIST_PRICE_LISTS_DEFAULT_LIMIT,
    );
    expect(
      listPriceListsContract.input.safeParse({ cursor: "nope" }).success,
    ).toBe(false);
    expect(
      listPriceListsContract.input.safeParse({
        limit: LIST_PRICE_LISTS_MAX_LIMIT + 1,
      }).success,
    ).toBe(false);
    expect(listPriceListsContract.input.safeParse({ limit: 0 }).success).toBe(
      false,
    );
    expect(parseListPriceListsCursor("nope")).toBeUndefined();
    expect(
      parseListPriceListsCursor(
        formatListPriceListsCursor(true, "not-a-uuid", "Default"),
      ),
    ).toBeUndefined();
  });

  it("round-trips a cursor whose name contains a pipe", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const cursor = formatListPriceListsCursor(false, id, "C|Special");
    expect(parseListPriceListsCursor(cursor)).toEqual({
      isDefault: false,
      id,
      name: "C|Special",
    });
  });
});
