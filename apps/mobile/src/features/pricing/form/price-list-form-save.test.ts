import { describe, expect, it } from "vitest";

import { emptyFieldErrors } from "./price-list-form.schema";
import {
  emptyPriceListFormDraft,
  snapshotFromDraft,
  type PriceListFormDraft,
  type PriceListFormFieldErrors,
  type PriceListFormMode,
  type PriceListFormSnapshot,
} from "./price-list-form-draft";
import {
  createPriceListPayload,
  type PriceListFormMutationResult,
  type PriceListFormWrite,
} from "./price-list-form-plan";
import {
  runPriceListFormSave,
  type LastWriteFailure,
  type PriceListFormSavePorts,
} from "./price-list-form-save";

const LIST_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";
const PRODUCT_A = "11111111-1111-4111-8111-111111111111";

function validCreateDraft(): PriceListFormDraft {
  return {
    ...emptyPriceListFormDraft(),
    name: "Опт",
    entries: [
      {
        key: PRODUCT_A,
        productId: PRODUCT_A,
        variantId: null,
        priceText: "10",
      },
    ],
  };
}

function createPorts(overrides: {
  readonly draft?: PriceListFormDraft;
  readonly mode?: PriceListFormMode;
  readonly priceListId?: string | null;
  readonly baseline?: PriceListFormSnapshot | null;
  readonly submit?: (
    write: PriceListFormWrite,
  ) => Promise<PriceListFormMutationResult>;
  readonly retry?: () => Promise<PriceListFormMutationResult>;
  readonly lastFailure?: LastWriteFailure;
  readonly lastWrite?: PriceListFormWrite | null;
}) {
  const calls: string[] = [];
  const originDrafts: PriceListFormDraft[] = [];
  let draft = overrides.draft ?? validCreateDraft();
  let baseline: PriceListFormSnapshot | null = overrides.baseline ?? null;
  let lastWrite = overrides.lastWrite ?? null;
  let lastFailure = overrides.lastFailure ?? { kind: null, wire: null };
  let fieldErrors: PriceListFormFieldErrors = emptyFieldErrors();
  const priceListId = { current: overrides.priceListId ?? null };
  const ports: PriceListFormSavePorts = {
    getDraft: () => draft,
    getMode: () => overrides.mode ?? "create",
    getPriceListId: () => priceListId.current,
    setPriceListId: (id) => {
      priceListId.current = id;
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
    setFieldErrors: (errors) => {
      fieldErrors = errors;
    },
    submit:
      overrides.submit ??
      ((write) => {
        calls.push(`submit:${write.kind}`);
        return Promise.resolve({ id: LIST_ID });
      }),
    retry:
      overrides.retry ??
      (() => {
        calls.push("retry");
        return Promise.resolve({ id: LIST_ID });
      }),
    resetMutation: () => {
      calls.push("reset");
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
    priceListId,
    getFieldErrors: () => fieldErrors,
  };
}

describe("runPriceListFormSave", () => {
  it("does not submit when the UI draft is invalid", async () => {
    const { ports, calls, getFieldErrors } = createPorts({
      draft: emptyPriceListFormDraft(),
    });
    await runPriceListFormSave(ports);
    expect(calls).toEqual([]);
    expect(getFieldErrors().name).toBe("required");
  });

  it("creates, stamps the id, and finishes without writing prices", async () => {
    const { ports, calls, originDrafts, priceListId } = createPorts({});
    await runPriceListFormSave(ports);
    expect(priceListId.current).toBe(LIST_ID);
    expect(calls).toEqual(["submit:createPriceList", "reset", "finish"]);
    expect(calls.join(",")).not.toContain("setEntries");
    expect(originDrafts).toHaveLength(1);
  });

  it("retries the in-flight write after a network failure", async () => {
    const input = createPriceListPayload(validCreateDraft());
    if (input === null) {
      throw new Error("expected a create payload");
    }
    const write: PriceListFormWrite = {
      kind: "createPriceList",
      input,
    };
    const { ports, calls } = createPorts({
      lastWrite: write,
      lastFailure: { kind: "network", wire: null },
    });
    await runPriceListFormSave(ports);
    expect(calls[0]).toBe("retry");
    expect(calls).not.toContain("submit:createPriceList");
  });

  it("noops an unchanged edit and still finishes", async () => {
    const draft = {
      ...emptyPriceListFormDraft(),
      name: "Опт",
    };
    const baseline = snapshotFromDraft(draft);
    if (baseline === null) {
      throw new Error("expected a snapshot");
    }
    const { ports, calls, originDrafts } = createPorts({
      mode: "edit",
      priceListId: LIST_ID,
      draft,
      baseline,
    });
    await runPriceListFormSave(ports);
    expect(calls).toEqual(["finish"]);
    expect(originDrafts).toHaveLength(1);
  });
});
