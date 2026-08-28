import { describe, expect, it } from "vitest";

import {
  formatListPriceListEntriesCursor,
  LIST_PRICE_LIST_ENTRIES_CURSOR_MAX,
  LIST_PRICE_LIST_ENTRIES_DEFAULT_LIMIT,
  LIST_PRICE_LIST_ENTRIES_MAX_LIMIT,
  listPriceListEntriesContract,
  listPriceListEntriesInputSchema,
  parseListPriceListEntriesCursor,
} from "./list-price-list-entries.contract.js";

const priceListId = "11111111-1111-4111-8111-111111111111";
const productId = "22222222-2222-4222-8222-222222222222";
const entryId = "33333333-3333-4333-8333-333333333333";

describe("pricing.listPriceListEntries contract", () => {
  it("is a staff client read with pricing:view", () => {
    expect(listPriceListEntriesContract.name).toBe(
      "pricing.listPriceListEntries",
    );
    expect(listPriceListEntriesContract.principal).toBe("staff");
    expect(listPriceListEntriesContract.transport).toBe("client");
    expect(listPriceListEntriesContract.risk).toBe("read");
    expect(listPriceListEntriesContract.permissions).toEqual(["pricing:view"]);
    expect(listPriceListEntriesContract.aiExposure).toBe("exposed");
    expect(listPriceListEntriesContract.audit).toBe(false);
    expect(listPriceListEntriesContract.idempotent).toBe(false);
    expect(listPriceListEntriesContract.emits).toEqual([]);
    expect(listPriceListEntriesContract.timeout).toBe(5_000);
    expect(LIST_PRICE_LIST_ENTRIES_DEFAULT_LIMIT).toBe(20);
    expect(LIST_PRICE_LIST_ENTRIES_MAX_LIMIT).toBe(50);
    expect(LIST_PRICE_LIST_ENTRIES_CURSOR_MAX).toBe(80);
  });

  it("defaults limit to 20 and rejects a malformed cursor or oversized limit", () => {
    expect(listPriceListEntriesInputSchema.parse({ priceListId }).limit).toBe(
      LIST_PRICE_LIST_ENTRIES_DEFAULT_LIMIT,
    );
    expect(
      listPriceListEntriesInputSchema.parse({
        priceListId,
        productId,
      }).productId,
    ).toBe(productId);
    expect(
      listPriceListEntriesInputSchema.safeParse({ cursor: "nope" }).success,
    ).toBe(false);
    expect(
      listPriceListEntriesInputSchema.safeParse({
        priceListId,
        limit: LIST_PRICE_LIST_ENTRIES_MAX_LIMIT + 1,
      }).success,
    ).toBe(false);
    expect(
      listPriceListEntriesInputSchema.safeParse({
        priceListId,
        limit: 0,
      }).success,
    ).toBe(false);
    expect(
      listPriceListEntriesInputSchema.safeParse({
        priceListId: "not-a-uuid",
      }).success,
    ).toBe(false);
    expect(parseListPriceListEntriesCursor("nope")).toBeUndefined();
  });

  it("round-trips a created-at cursor", () => {
    const createdAt = new Date("2026-03-01T00:00:00.000Z");
    const cursor = formatListPriceListEntriesCursor(createdAt, entryId);
    expect(parseListPriceListEntriesCursor(cursor)).toEqual({
      createdAt: createdAt.toISOString(),
      id: entryId,
    });
  });
});
