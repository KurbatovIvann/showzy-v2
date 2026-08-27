import { describe, expect, it } from "vitest";

import { emptyFieldErrors } from "./product-form.schema";
import {
  emptyProductFormDraft,
  snapshotFromDraft,
  type ProductFormDraft,
  type ProductFormFieldErrors,
  type ProductFormMode,
  type ProductFormSnapshot,
} from "./product-form-draft";
import type {
  ProductFormMutationResult,
  ProductFormWrite,
} from "./product-form-plan";
import {
  runProductFormSave,
  type LastWriteFailure,
  type ProductFormSavePorts,
} from "./product-form-save";

const PRODUCT_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";
const VARIANT_A = "11111111-1111-4111-8111-111111111111";
const VARIANT_B = "22222222-2222-4222-8222-222222222222";

function validCreateDraft(): ProductFormDraft {
  return {
    name: "Торт",
    priceText: "10",
    nextDraftSerial: 1,
    variants: [],
  };
}

function createDraftWithVariants(): ProductFormDraft {
  return {
    name: "Торт",
    priceText: "10",
    nextDraftSerial: 3,
    variants: [
      {
        key: "draft-1",
        variantId: null,
        name: "1 кг",
        priceText: "1800",
        archived: false,
      },
      {
        key: "draft-2",
        variantId: null,
        name: "0.5 кг",
        priceText: "900",
        archived: false,
      },
    ],
  };
}

function originalEditDraft(): ProductFormDraft {
  return {
    name: "Торт",
    priceText: "1500",
    nextDraftSerial: 1,
    variants: [
      {
        key: VARIANT_A,
        variantId: VARIANT_A,
        name: "1 кг",
        priceText: "1800",
        archived: false,
      },
      {
        key: VARIANT_B,
        variantId: VARIANT_B,
        name: "0.5 кг",
        priceText: "900",
        archived: false,
      },
    ],
  };
}

function dirtyEditDraft(): ProductFormDraft {
  return {
    name: "Наполеон",
    priceText: "1600",
    nextDraftSerial: 1,
    variants: [
      {
        key: VARIANT_A,
        variantId: VARIANT_A,
        name: "2 кг",
        priceText: "2000",
        archived: false,
      },
      {
        key: VARIANT_B,
        variantId: VARIANT_B,
        name: "1 кг",
        priceText: "1000",
        archived: false,
      },
    ],
  };
}

function createPorts(overrides: {
  readonly draft?: ProductFormDraft;
  readonly mode?: ProductFormMode;
  readonly productId?: string | null;
  readonly baseline?: ProductFormSnapshot | null;
  readonly submit?: (
    write: ProductFormWrite,
  ) => Promise<ProductFormMutationResult>;
  readonly retry?: () => Promise<ProductFormMutationResult>;
  readonly lastFailure?: LastWriteFailure;
  readonly lastWrite?: ProductFormWrite | null;
  readonly flushResult?: "ok" | "commit-failed" | "upload-failed";
}) {
  const calls: string[] = [];
  const originDrafts: ProductFormDraft[] = [];
  let draft = overrides.draft ?? validCreateDraft();
  let baseline: ProductFormSnapshot | null = overrides.baseline ?? null;
  let lastWrite = overrides.lastWrite ?? null;
  let lastFailure = overrides.lastFailure ?? { kind: null, wire: null };
  let clientErrors: ProductFormFieldErrors = emptyFieldErrors();
  const productId = { current: overrides.productId ?? null };
  const ports: ProductFormSavePorts = {
    getDraft: () => draft,
    getMode: () => overrides.mode ?? "create",
    getProductId: () => productId.current,
    setProductId: (id) => {
      productId.current = id;
    },
    getBaseline: () => baseline,
    setDraft: (next) => {
      draft = next;
    },
    setBaseline: (next) => {
      baseline = next;
    },
    setOrigin: (next) => {
      originDrafts.push(next);
    },
    getLastWrite: () => lastWrite,
    setLastWrite: (write) => {
      lastWrite = write;
    },
    getLastFailure: () => lastFailure,
    setLastFailure: (failure) => {
      lastFailure = failure;
    },
    setClientErrors: (errors) => {
      clientErrors = errors;
    },
    setTooManyVariants: () => {
      calls.push("too-many");
    },
    submit:
      overrides.submit ??
      ((write) => {
        calls.push(`submit:${write.kind}`);
        return Promise.resolve({
          kind: "product" as const,
          productId: PRODUCT_ID,
        });
      }),
    retry:
      overrides.retry ??
      (() => {
        calls.push("retry");
        return Promise.resolve({
          kind: "product" as const,
          productId: PRODUCT_ID,
        });
      }),
    resetMutation: () => {
      calls.push("reset");
    },
    bindProductId: (id) => {
      calls.push(`bind:${id}`);
    },
    flushPhotos: () => {
      calls.push("flush");
      return Promise.resolve(overrides.flushResult ?? "ok");
    },
    finish: () => {
      calls.push("finish");
      return Promise.resolve();
    },
  };
  return {
    ports,
    calls,
    originDrafts,
    productId,
    getBaseline: () => baseline,
    getDraft: () => draft,
    getClientErrors: () => clientErrors,
  };
}

describe("runProductFormSave", () => {
  it("does not submit when the UI draft is invalid", async () => {
    const { ports, calls, getClientErrors } = createPorts({
      draft: emptyProductFormDraft(),
    });
    await runProductFormSave(ports);
    expect(calls).toEqual([]);
    expect(getClientErrors().name).toBe("required");
    expect(getClientErrors().price).toBe("required");
  });

  it("creates, binds the product id, flushes photos, and finishes", async () => {
    const { ports, calls, originDrafts, productId } = createPorts({});
    await runProductFormSave(ports);
    expect(productId.current).toBe(PRODUCT_ID);
    expect(calls).toEqual([
      "submit:createProduct",
      `bind:${PRODUCT_ID}`,
      "reset",
      "flush",
      "finish",
    ]);
    expect(originDrafts).toHaveLength(1);
  });

  it("does not finish when writes are done and flushPhotos returns upload-failed", async () => {
    const { ports, calls, originDrafts } = createPorts({
      flushResult: "upload-failed",
    });
    await runProductFormSave(ports);
    expect(calls).toEqual([
      "submit:createProduct",
      `bind:${PRODUCT_ID}`,
      "reset",
      "flush",
    ]);
    expect(calls).not.toContain("finish");
    expect(originDrafts).toHaveLength(0);
  });

  it("does not finish when form writes are already done and flushPhotos returns upload-failed", async () => {
    const draft = validCreateDraft();
    const baseline = snapshotFromDraft(draft);
    if (baseline === null) {
      throw new Error("expected a snapshot from a valid draft");
    }
    const { ports, calls, originDrafts } = createPorts({
      mode: "edit",
      productId: PRODUCT_ID,
      baseline,
      flushResult: "upload-failed",
    });
    await runProductFormSave(ports);
    expect(calls).toEqual(["flush"]);
    expect(calls).not.toContain("finish");
    expect(originDrafts).toHaveLength(0);
  });

  it("retries the in-flight write after a network failure", async () => {
    const write: ProductFormWrite = {
      kind: "createProduct",
      input: {
        name: "Торт",
        basePriceMinor: "1000",
        currency: "UAH",
      },
      variantKeys: [],
    };
    const { ports, calls } = createPorts({
      lastWrite: write,
      lastFailure: { kind: "network", wire: null },
    });
    await runProductFormSave(ports);
    expect(calls[0]).toBe("retry");
    expect(calls).not.toContain("submit:createProduct");
  });

  it("keeps origin uncommitted after a mid-loop edit failure and retries remaining writes only", async () => {
    const baseline = snapshotFromDraft(originalEditDraft());
    expect(baseline).not.toBeNull();
    if (baseline === null) {
      return;
    }
    let variantFailures = 0;
    const { ports, calls, originDrafts, getBaseline } = createPorts({
      mode: "edit",
      productId: PRODUCT_ID,
      draft: dirtyEditDraft(),
      baseline,
      submit: (write) => {
        calls.push(`submit:${write.kind}`);
        if (write.kind === "updateVariant" && variantFailures === 0) {
          variantFailures += 1;
          return Promise.reject(new TypeError("Failed to fetch"));
        }
        if (write.kind === "updateVariant") {
          return Promise.resolve({
            kind: "variant" as const,
            variantId: write.input.variantId,
          });
        }
        return Promise.resolve({
          kind: "product" as const,
          productId: PRODUCT_ID,
        });
      },
    });

    await expect(runProductFormSave(ports)).rejects.toThrow(/Failed to fetch/);
    expect(calls.filter((call) => call.startsWith("submit:"))).toEqual([
      "submit:updateProduct",
      "submit:updateVariant",
    ]);
    expect(originDrafts).toHaveLength(0);
    expect(calls).not.toContain("finish");
    expect(calls).not.toContain("flush");
    expect(getBaseline()?.name).toBe("Наполеон");

    calls.length = 0;
    await runProductFormSave(ports);
    expect(calls.filter((call) => call.startsWith("submit:"))).toEqual([
      "submit:updateVariant",
      "submit:updateVariant",
    ]);
    expect(calls).not.toContain("submit:updateProduct");
    expect(originDrafts).toHaveLength(1);
    expect(calls.at(-2)).toBe("flush");
    expect(calls.at(-1)).toBe("finish");
  });

  it("does not createVariant on retry after create+variants when photo flush fails", async () => {
    const draft = createDraftWithVariants();
    const createdVariants = [
      {
        variantId: VARIANT_B,
        name: "0.5 кг",
        basePriceMinor: "90000",
        currency: "UAH",
      },
      {
        variantId: VARIANT_A,
        name: "1 кг",
        basePriceMinor: "180000",
        currency: "UAH",
      },
    ] as const;
    const { ports, calls, originDrafts, getDraft } = createPorts({
      draft,
      flushResult: "upload-failed",
      submit: (write) => {
        calls.push(`submit:${write.kind}`);
        if (write.kind === "createProduct") {
          return Promise.resolve({
            kind: "product" as const,
            productId: PRODUCT_ID,
            variants: createdVariants,
          });
        }
        if (write.kind === "createVariant") {
          return Promise.resolve({
            kind: "variant" as const,
            variantId: "33333333-3333-4333-8333-333333333333",
          });
        }
        return Promise.resolve({
          kind: "product" as const,
          productId: PRODUCT_ID,
        });
      },
    });

    await runProductFormSave(ports);
    expect(calls.filter((call) => call.startsWith("submit:"))).toEqual([
      "submit:createProduct",
    ]);
    expect(calls).toContain("flush");
    expect(calls).not.toContain("finish");
    expect(originDrafts).toHaveLength(0);
    expect(
      getDraft().variants.map((variant) => ({
        name: variant.name,
        variantId: variant.variantId,
      })),
    ).toEqual([
      { name: "1 кг", variantId: VARIANT_A },
      { name: "0.5 кг", variantId: VARIANT_B },
    ]);

    calls.length = 0;
    await runProductFormSave(ports);
    expect(calls.filter((call) => call.startsWith("submit:"))).toEqual([]);
    expect(calls).not.toContain("submit:createVariant");
    expect(calls).toEqual(["flush"]);
    expect(calls).not.toContain("finish");
    expect(getDraft().variants).toHaveLength(2);
    expect(
      new Set(getDraft().variants.map((variant) => variant.variantId)),
    ).toEqual(new Set([VARIANT_A, VARIANT_B]));
  });
});
