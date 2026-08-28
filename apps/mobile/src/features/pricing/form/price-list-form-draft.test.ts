import { describe, expect, it } from "vitest";

import { moneyToWire } from "@showzy/contract";

import { formatMajorUnitsFromMinor } from "../../../format/money-input";
import {
  applyBulkPercentOff,
  applyPercentOffMinor,
  blocksDeactivateWhenDefault,
  draftFromPriceList,
  emptyPriceListFormDraft,
  isPriceListFormDirty,
  mergeExpandedVariants,
  listPriceDiff,
  parseBulkPercent,
  parsePriceListFormUiDraft,
  priceListEntryKey,
  shouldPreventPriceListLeave,
  snapshotFromDraft,
  storedEntryMap,
  type PriceListFormDraft,
} from "./price-list-form-draft";

const PRODUCT_A = "11111111-1111-4111-8111-111111111111";
const PRODUCT_B = "22222222-2222-4222-8222-222222222222";
const VARIANT_A = "33333333-3333-4333-8333-333333333333";

function draftWithPrices(args: {
  readonly productPrice?: string;
  readonly variantPrice?: string;
}): PriceListFormDraft {
  return {
    name: "Опт",
    isDefault: false,
    isActive: true,
    entries: [
      {
        key: priceListEntryKey(PRODUCT_A, null),
        productId: PRODUCT_A,
        variantId: null,
        priceText: args.productPrice ?? "",
      },
      {
        key: priceListEntryKey(PRODUCT_A, VARIANT_A),
        productId: PRODUCT_A,
        variantId: VARIANT_A,
        priceText: args.variantPrice ?? "",
      },
    ],
  };
}

describe("price-list form draft", () => {
  it("treats empty vs stored 0 as different dirty states", () => {
    const origin = draftWithPrices({ productPrice: "" });
    expect(isPriceListFormDirty(draftWithPrices({ productPrice: "" }), origin)).toBe(
      false,
    );
    expect(
      isPriceListFormDirty(draftWithPrices({ productPrice: "0" }), origin),
    ).toBe(true);
    const fromZero = snapshotFromDraft(draftWithPrices({ productPrice: "0" }));
    expect(fromZero?.entries[0]?.priceMinor).toBe("0");
    const fromEmpty = snapshotFromDraft(draftWithPrices({ productPrice: "" }));
    expect(fromEmpty?.entries[0]?.priceMinor).toBeNull();
  });

  it("blocks leave only when dirty, not pending, and not already armed", () => {
    expect(
      shouldPreventPriceListLeave({
        dirty: true,
        pending: false,
        leaveArmed: false,
      }),
    ).toBe(true);
    expect(
      shouldPreventPriceListLeave({
        dirty: true,
        pending: true,
        leaveArmed: false,
      }),
    ).toBe(false);
    expect(
      shouldPreventPriceListLeave({
        dirty: false,
        pending: false,
        leaveArmed: false,
      }),
    ).toBe(false);
  });

  it("parses bulk % as integers 1–100 and applies only product-level rows", () => {
    expect(parseBulkPercent("")).toEqual({ ok: false });
    expect(parseBulkPercent("0")).toEqual({ ok: false });
    expect(parseBulkPercent("101")).toEqual({ ok: false });
    expect(parseBulkPercent("10")).toEqual({ ok: true, percent: 10 });
    expect(applyPercentOffMinor(110000n, 10)).toBe(99000n);

    const applied = applyBulkPercentOff({
      draft: draftWithPrices({
        productPrice: "",
        variantPrice: "5",
      }),
      percent: 10,
      basePriceMinorByProductId: new Map([
        [PRODUCT_A, "110000"],
        [PRODUCT_B, "5700"],
      ]),
    });
    expect(
      applied.entries.find((entry) => entry.variantId === null)?.priceText,
    ).toBe(formatMajorUnitsFromMinor(moneyToWire(99000n)));
    expect(
      applied.entries.find((entry) => entry.variantId === VARIANT_A)?.priceText,
    ).toBe("5");
  });

  it("expands variants without inventing a stored row when the field stays empty", () => {
    const draft = draftFromPriceList({
      name: "Опт",
      isDefault: false,
      isActive: true,
      products: [
        {
          id: PRODUCT_A,
          name: "Торт",
          basePriceMinor: "150000",
          variantCount: 1,
          archived: false,
        },
      ],
      stored: storedEntryMap([]),
    });
    const origin = { ...draft, entries: [...draft.entries] };
    const merged = mergeExpandedVariants({
      draft,
      origin,
      baseline: snapshotFromDraft(draft),
      productId: PRODUCT_A,
      variants: [
        {
          id: VARIANT_A,
          name: "1 кг",
          basePriceMinor: "180000",
          archived: false,
        },
      ],
      stored: storedEntryMap([]),
    });
    expect(merged.draft.entries).toHaveLength(2);
    expect(merged.draft.entries[1]).toMatchObject({
      productId: PRODUCT_A,
      variantId: VARIANT_A,
      priceText: "",
    });
    expect(isPriceListFormDirty(merged.draft, merged.origin)).toBe(false);
    expect(parsePriceListFormUiDraft(merged.draft).ok).toBe(true);
  });

  it("blocks deactivating the default in the UI model", () => {
    expect(
      blocksDeactivateWhenDefault({ isDefault: true, nextActive: false }),
    ).toBe(true);
    expect(
      blocksDeactivateWhenDefault({ isDefault: false, nextActive: false }),
    ).toBe(false);
    expect(emptyPriceListFormDraft().isActive).toBe(true);
  });

  it("keeps stored variant rows on hydrate so save cannot drop them", () => {
    const draft = draftFromPriceList({
      name: "Опт",
      isDefault: false,
      isActive: true,
      products: [
        {
          id: PRODUCT_A,
          name: "Торт",
          basePriceMinor: "150000",
          variantCount: 1,
          archived: true,
        },
      ],
      stored: storedEntryMap([
        { productId: PRODUCT_A, variantId: null, priceMinor: "10000" },
        { productId: PRODUCT_A, variantId: VARIANT_A, priceMinor: "0" },
      ]),
    });
    expect(draft.entries).toEqual([
      {
        key: priceListEntryKey(PRODUCT_A, null),
        productId: PRODUCT_A,
        variantId: null,
        priceText: formatMajorUnitsFromMinor("10000"),
      },
      {
        key: priceListEntryKey(PRODUCT_A, VARIANT_A),
        productId: PRODUCT_A,
        variantId: VARIANT_A,
        priceText: formatMajorUnitsFromMinor("0"),
      },
    ]);
  });

  it("formats display-only percent vs catalog base, including stored 0", () => {
    expect(listPriceDiff({ priceText: "", basePriceMinor: "10000" })).toEqual({
      label: "—",
      tone: "empty",
    });
    expect(listPriceDiff({ priceText: "0", basePriceMinor: "10000" })).toEqual({
      label: "-100%",
      tone: "down",
    });
    expect(listPriceDiff({ priceText: "110", basePriceMinor: "10000" })).toEqual({
      label: "+10%",
      tone: "up",
    });
  });
});
