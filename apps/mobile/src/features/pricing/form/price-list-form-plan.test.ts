import { describe, expect, it } from "vitest";

import { SET_PRICE_LIST_ENTRIES_MAX_ITEMS } from "../shared/price-list-caps";
import { priceListEditorHref } from "../shared/price-list-hrefs";
import {
  applyBulkPercentOff,
  emptyPriceListFormDraft,
  mergeExpandedVariants,
  priceListEntryKey,
  snapshotFromDraft,
  type PriceListFormDraft,
} from "./price-list-form-draft";
import {
  applyWriteSuccess,
  parseThenPlanPriceListFormSave,
  planPriceListFormSave,
  priceListFormSaveNavigation,
  remainingFormWrites,
  type PriceListFormWrite,
} from "./price-list-form-plan";

const LIST_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";
const PRODUCT_A = "11111111-1111-4111-8111-111111111111";
const PRODUCT_B = "22222222-2222-4222-8222-222222222222";
const VARIANT_A = "33333333-3333-4333-8333-333333333333";

function namedDraft(
  patch: Partial<PriceListFormDraft> = {},
): PriceListFormDraft {
  return {
    ...emptyPriceListFormDraft(),
    name: "Опт",
    ...patch,
  };
}

function productEntry(
  productId: string,
  priceText: string,
  variantId: string | null = null,
) {
  return {
    key: priceListEntryKey(productId, variantId),
    productId,
    variantId,
    priceText,
  };
}

describe("priceListFormSaveNavigation", () => {
  it("replaces to the editor after create and leaves after edit", () => {
    expect(priceListFormSaveNavigation("create", LIST_ID)).toEqual({
      kind: "replaceEditor",
      href: priceListEditorHref(LIST_ID),
    });
    expect(priceListFormSaveNavigation("edit", LIST_ID)).toEqual({
      kind: "leave",
    });
  });
});

describe("planPriceListFormSave", () => {
  it("creates the list without sending price entries, then navigates to edit", () => {
    const draft = namedDraft({
      entries: [productEntry(PRODUCT_A, "10")],
    });
    const plan = planPriceListFormSave({
      mode: "create",
      priceListId: null,
      draft,
      baseline: null,
      lastWrite: null,
      lastFailureKind: null,
    });
    expect(plan.kind).toBe("write");
    if (plan.kind !== "write") {
      return;
    }
    expect(plan.write.kind).toBe("createPriceList");
    if (plan.write.kind !== "createPriceList") {
      return;
    }
    expect(plan.write.input).toEqual({
      name: "Опт",
      isDefault: false,
      isActive: true,
    });
    expect(plan.write.input).not.toHaveProperty("entries");
    const applied = applyWriteSuccess({
      draft,
      baseline: null,
      write: plan.write,
    });
    expect(applied.done).toBe(true);
  });

  it("retries the same create after a network failure", () => {
    const first = planPriceListFormSave({
      mode: "create",
      priceListId: null,
      draft: namedDraft(),
      baseline: null,
      lastWrite: null,
      lastFailureKind: null,
    });
    expect(first.kind).toBe("write");
    if (first.kind !== "write") {
      return;
    }
    expect(
      planPriceListFormSave({
        mode: "create",
        priceListId: null,
        draft: namedDraft(),
        baseline: null,
        lastWrite: first.write,
        lastFailureKind: "network",
      }),
    ).toEqual({ kind: "retry" });
  });

  it("stays invalid without planning a write", () => {
    expect(
      parseThenPlanPriceListFormSave({
        mode: "create",
        priceListId: null,
        draft: emptyPriceListFormDraft(),
        baseline: null,
        lastWrite: null,
        lastFailureKind: null,
      }).kind,
    ).toBe("invalid");
  });
});

describe("remainingFormWrites empty vs 0", () => {
  it("removes an emptied field and upserts stored 0 as money wire 0", () => {
    const origin = namedDraft({
      entries: [productEntry(PRODUCT_A, "10"), productEntry(PRODUCT_B, "")],
    });
    const baseline = snapshotFromDraft(origin);
    if (baseline === null) {
      throw new Error("expected a snapshot");
    }
    const emptied = snapshotFromDraft(
      namedDraft({
        entries: [productEntry(PRODUCT_A, ""), productEntry(PRODUCT_B, "0")],
      }),
    );
    if (emptied === null) {
      throw new Error("expected a snapshot");
    }
    const writes = remainingFormWrites(LIST_ID, emptied, baseline);
    expect(writes).toEqual([
      {
        kind: "setEntries",
        input: {
          priceListId: LIST_ID,
          entries: [
            {
              productId: PRODUCT_B,
              priceMinor: "0",
              currency: "UAH",
            },
          ],
        },
      },
      {
        kind: "removeEntries",
        input: {
          priceListId: LIST_ID,
          entries: [{ productId: PRODUCT_A }],
        },
      },
    ]);
  });

  it("does not send empty set or remove batches", () => {
    const draft = namedDraft({
      entries: [productEntry(PRODUCT_A, "10")],
    });
    const snapshot = snapshotFromDraft(draft);
    if (snapshot === null) {
      throw new Error("expected a snapshot");
    }
    expect(remainingFormWrites(LIST_ID, snapshot, snapshot)).toEqual([]);
  });
});

describe("remainingFormWrites bulk % and variants", () => {
  it("plans product-level setEntries only after bulk %, never variant rows", () => {
    const origin = namedDraft({
      entries: [
        productEntry(PRODUCT_A, ""),
        productEntry(PRODUCT_A, "", VARIANT_A),
      ],
    });
    const baseline = snapshotFromDraft(origin);
    if (baseline === null) {
      throw new Error("expected a snapshot");
    }
    const applied = applyBulkPercentOff({
      draft: origin,
      percent: 10,
      basePriceMinorByProductId: new Map([[PRODUCT_A, "10000"]]),
    });
    const snapshot = snapshotFromDraft(applied);
    if (snapshot === null) {
      throw new Error("expected a snapshot");
    }
    const writes = remainingFormWrites(LIST_ID, snapshot, baseline);
    expect(writes).toHaveLength(1);
    const write = writes[0];
    expect(write?.kind).toBe("setEntries");
    if (write?.kind !== "setEntries") {
      return;
    }
    expect(write.input.entries).toEqual([
      {
        productId: PRODUCT_A,
        priceMinor: "9000",
        currency: "UAH",
      },
    ]);
    expect(write.input.entries[0]).not.toHaveProperty("variantId");
  });

  it("does not write a variant row after expand when the field stays empty", () => {
    const origin = namedDraft({
      entries: [productEntry(PRODUCT_A, "10")],
    });
    const baseline = snapshotFromDraft(origin);
    const merged = mergeExpandedVariants({
      draft: origin,
      origin,
      baseline,
      productId: PRODUCT_A,
      variants: [
        {
          id: VARIANT_A,
          name: "1 кг",
          basePriceMinor: "180000",
          archived: false,
        },
      ],
      stored: new Map(),
    });
    const snapshot = snapshotFromDraft(merged.draft);
    if (snapshot === null || merged.baseline === null) {
      throw new Error("expected snapshots");
    }
    expect(remainingFormWrites(LIST_ID, snapshot, merged.baseline)).toEqual([]);
  });

  it("sets a variant row with variantId when the expanded field is filled", () => {
    const origin = namedDraft({
      entries: [productEntry(PRODUCT_A, "")],
    });
    const merged = mergeExpandedVariants({
      draft: origin,
      origin,
      baseline: snapshotFromDraft(origin),
      productId: PRODUCT_A,
      variants: [
        { id: VARIANT_A, name: "1 кг", basePriceMinor: null, archived: false },
      ],
      stored: new Map(),
    });
    const filled: PriceListFormDraft = {
      ...merged.draft,
      entries: merged.draft.entries.map((entry) =>
        entry.variantId === VARIANT_A ? { ...entry, priceText: "12" } : entry,
      ),
    };
    const snapshot = snapshotFromDraft(filled);
    if (snapshot === null || merged.baseline === null) {
      throw new Error("expected snapshots");
    }
    const writes = remainingFormWrites(LIST_ID, snapshot, merged.baseline);
    expect(writes[0]).toMatchObject({
      kind: "setEntries",
      input: {
        priceListId: LIST_ID,
        entries: [
          {
            productId: PRODUCT_A,
            variantId: VARIANT_A,
            priceMinor: "1200",
            currency: "UAH",
          },
        ],
      },
    });
  });

  it("chunks setEntries at SET_PRICE_LIST_ENTRIES_MAX_ITEMS and skips empty batches", () => {
    const ids = Array.from({ length: SET_PRICE_LIST_ENTRIES_MAX_ITEMS + 1 }, (_, index) => {
      const n = (index + 1).toString(16).padStart(12, "0");
      return `aaaaaaaa-bbbb-4ccc-8ddd-${n}`;
    });
    const empty = namedDraft({
      entries: ids.map((id) => productEntry(id, "")),
    });
    const filled = namedDraft({
      entries: ids.map((id) => productEntry(id, "1")),
    });
    const baseline = snapshotFromDraft(empty);
    const snapshot = snapshotFromDraft(filled);
    if (baseline === null || snapshot === null) {
      throw new Error("expected snapshots");
    }
    const writes = remainingFormWrites(LIST_ID, snapshot, baseline);
    expect(writes).toHaveLength(2);
    if (writes[0]?.kind !== "setEntries" || writes[1]?.kind !== "setEntries") {
      throw new Error("expected two set batches");
    }
    expect(writes[0].input.entries).toHaveLength(
      SET_PRICE_LIST_ENTRIES_MAX_ITEMS,
    );
    expect(writes[1].input.entries).toHaveLength(1);
  });
});

describe("status writes", () => {
  it("plans name then setDefault (which forces active) and never deactivates the default", () => {
    const origin = namedDraft({ name: "Опт", isDefault: false, isActive: false });
    const baseline = snapshotFromDraft(origin);
    const next = snapshotFromDraft(
      namedDraft({ name: "Партнери", isDefault: true, isActive: false }),
    );
    if (baseline === null || next === null) {
      throw new Error("expected snapshots");
    }
    expect(next.isActive).toBe(true);
    const writes = remainingFormWrites(LIST_ID, next, baseline);
    expect(writes.map((write: PriceListFormWrite) => write.kind)).toEqual([
      "updatePriceList",
      "setDefault",
    ]);
  });
});
