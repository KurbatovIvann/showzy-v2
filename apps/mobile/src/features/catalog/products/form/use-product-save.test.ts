import { describe, expect, it } from "vitest";

import { emptyFieldErrors } from "./product-form.schema";
import {
  emptyProductFormDraft,
  type ProductFormDraft,
  type ProductFormFieldErrors,
  type ProductFormMutationResult,
  type ProductFormSnapshot,
  type ProductFormWrite,
} from "./product-form-model";
import {
  runProductFormSave,
  type LastWriteFailure,
  type ProductFormSavePorts,
} from "./product-form-save";

const PRODUCT_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";

function validCreateDraft(): ProductFormDraft {
  return {
    name: "Торт",
    priceText: "10",
    nextDraftSerial: 1,
    variants: [],
  };
}

function createPorts(overrides: {
  readonly draft?: ProductFormDraft;
  readonly submit?: (
    write: ProductFormWrite,
  ) => Promise<ProductFormMutationResult>;
  readonly retry?: () => Promise<ProductFormMutationResult>;
  readonly lastFailure?: LastWriteFailure;
  readonly lastWrite?: ProductFormWrite | null;
}) {
  const calls: string[] = [];
  let draft = overrides.draft ?? validCreateDraft();
  let baseline: ProductFormSnapshot | null = null;
  let lastWrite = overrides.lastWrite ?? null;
  let lastFailure = overrides.lastFailure ?? { kind: null, wire: null };
  let clientErrors: ProductFormFieldErrors = emptyFieldErrors();
  const productId = { current: null as string | null };
  const ports: ProductFormSavePorts = {
    getDraft: () => draft,
    getMode: () => "create",
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
    setOrigin: () => {},
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
      return Promise.resolve("ok" as const);
    },
    finish: () => {
      calls.push("finish");
      return Promise.resolve();
    },
  };
  return { ports, calls, productId, getClientErrors: () => clientErrors };
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
    const { ports, calls, productId } = createPorts({});
    await runProductFormSave(ports);
    expect(productId.current).toBe(PRODUCT_ID);
    expect(calls).toEqual([
      "submit:createProduct",
      `bind:${PRODUCT_ID}`,
      "reset",
      "flush",
      "finish",
    ]);
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
});
