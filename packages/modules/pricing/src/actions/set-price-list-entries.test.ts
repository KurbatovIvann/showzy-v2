import { describe, expect, it } from "vitest";

import { INT64_MAX } from "../wire.contract.js";
import {
  SET_PRICE_LIST_ENTRIES_MAX_ITEMS,
  setPriceListEntriesContract,
  setPriceListEntriesInputSchema,
  setPriceListEntriesOutputSchema,
} from "./set-price-list-entries.contract.js";

const priceListId = "11111111-1111-4111-8111-111111111111";
const productId = "22222222-2222-4222-8222-222222222222";
const variantId = "33333333-3333-4333-8333-333333333333";

function productIdAt(index: number): string {
  return `44444444-4444-4444-8444-${String(index).padStart(12, "0")}`;
}

describe("pricing.setPriceListEntries contract", () => {
  it("is an idempotent audited staff client write with pricing:manage, 10s timeout, and no events", () => {
    expect(setPriceListEntriesContract.name).toBe(
      "pricing.setPriceListEntries",
    );
    expect(setPriceListEntriesContract.principal).toBe("staff");
    expect(setPriceListEntriesContract.transport).toBe("client");
    expect(setPriceListEntriesContract.risk).toBe("write");
    expect(setPriceListEntriesContract.permissions).toEqual(["pricing:manage"]);
    expect(setPriceListEntriesContract.aiExposure).toBe("exposed");
    expect(setPriceListEntriesContract.requiresConfirmation).toBe(false);
    expect(setPriceListEntriesContract.idempotent).toBe(true);
    expect(setPriceListEntriesContract.audit).toBe(true);
    expect(setPriceListEntriesContract.emits).toEqual([]);
    expect(setPriceListEntriesContract.atomicCalls).toEqual([]);
    expect(setPriceListEntriesContract.atomicCallers).toEqual([]);
    expect(setPriceListEntriesContract.timeout).toBe(10_000);
    expect(setPriceListEntriesContract.rateLimit).toBeUndefined();
    expect(SET_PRICE_LIST_ENTRIES_MAX_ITEMS).toBe(200);
    expect(
      Object.keys(setPriceListEntriesOutputSchema.shape).toSorted(),
    ).toEqual(["items"]);
  });

  it("defaults currency to UAH and accepts a stored zero", () => {
    const parsed = setPriceListEntriesInputSchema.parse({
      priceListId,
      entries: [{ productId, priceMinor: "0" }],
    });
    expect(parsed).toEqual({
      priceListId,
      entries: [{ productId, priceMinor: "0", currency: "UAH" }],
    });
    expect(
      setPriceListEntriesInputSchema.parse({
        priceListId,
        entries: [
          {
            productId,
            variantId,
            priceMinor: "100",
            currency: "UAH",
          },
        ],
      }).entries[0],
    ).toEqual({
      productId,
      variantId,
      priceMinor: "100",
      currency: "UAH",
    });
  });

  it("rejects empty batches, oversize batches, negative prices, and non-UAH currency", () => {
    expect(
      setPriceListEntriesInputSchema.safeParse({
        priceListId,
        entries: [],
      }).success,
    ).toBe(false);
    expect(
      setPriceListEntriesInputSchema.safeParse({
        priceListId,
        entries: Array.from(
          { length: SET_PRICE_LIST_ENTRIES_MAX_ITEMS + 1 },
          (_, index) => ({
            productId: productIdAt(index),
            priceMinor: "1",
          }),
        ),
      }).success,
    ).toBe(false);
    expect(
      setPriceListEntriesInputSchema.safeParse({
        priceListId,
        entries: [{ productId, priceMinor: "-1" }],
      }).success,
    ).toBe(false);
    expect(
      setPriceListEntriesInputSchema.safeParse({
        priceListId,
        entries: [{ productId, priceMinor: "01" }],
      }).success,
    ).toBe(false);
    expect(
      setPriceListEntriesInputSchema.safeParse({
        priceListId,
        entries: [{ productId, priceMinor: (INT64_MAX + 1n).toString(10) }],
      }).success,
    ).toBe(false);
    expect(
      setPriceListEntriesInputSchema.safeParse({
        priceListId,
        entries: [{ productId, priceMinor: "100", currency: "USD" }],
      }).success,
    ).toBe(false);
    expect(
      setPriceListEntriesInputSchema.safeParse({
        priceListId,
        entries: [{ productId, priceMinor: "100", currency: "uah" }],
      }).success,
    ).toBe(false);
  });

  it("rejects identifier fields — the input is strict", () => {
    const valid = {
      priceListId,
      entries: [{ productId, priceMinor: "100" }],
    };
    for (const extra of [
      { companyId: "c" },
      { id: priceListId },
      { userId: "u" },
    ]) {
      expect(
        setPriceListEntriesInputSchema.safeParse({ ...valid, ...extra })
          .success,
      ).toBe(false);
    }
  });
});
