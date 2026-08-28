import { describe, expect, it } from "vitest";

import { emptyFieldErrors } from "./counterparty-form.schema";
import {
  emptyCounterpartyFormDraft,
  snapshotFromDraft,
  type CounterpartyFormDraft,
  type CounterpartyFormFieldErrors,
  type CounterpartyFormMode,
  type CounterpartyFormSnapshot,
} from "./counterparty-form-draft";
import {
  createCounterpartyPayload,
  type CounterpartyFormMutationResult,
  type CounterpartyFormWrite,
} from "./counterparty-form-plan";
import {
  runCounterpartyFormSave,
  type LastWriteFailure,
  type CounterpartyFormSavePorts,
} from "./counterparty-form-save";

const COUNTERPARTY_ID = "33333333-3333-4333-8333-333333333333";

function validCreateDraft(): CounterpartyFormDraft {
  return {
    ...emptyCounterpartyFormDraft(),
    name: "ФОП Іваненко",
  };
}

function createPorts(overrides: {
  readonly draft?: CounterpartyFormDraft;
  readonly mode?: CounterpartyFormMode;
  readonly counterpartyId?: string | null;
  readonly baseline?: CounterpartyFormSnapshot | null;
  readonly submit?: (
    write: CounterpartyFormWrite,
  ) => Promise<CounterpartyFormMutationResult>;
  readonly retry?: () => Promise<CounterpartyFormMutationResult>;
  readonly lastFailure?: LastWriteFailure;
  readonly lastWrite?: CounterpartyFormWrite | null;
}) {
  const calls: string[] = [];
  const originDrafts: CounterpartyFormDraft[] = [];
  let draft = overrides.draft ?? validCreateDraft();
  let baseline: CounterpartyFormSnapshot | null = overrides.baseline ?? null;
  let lastWrite = overrides.lastWrite ?? null;
  let lastFailure = overrides.lastFailure ?? { kind: null, wire: null };
  let fieldErrors: CounterpartyFormFieldErrors = emptyFieldErrors();
  const counterpartyId = { current: overrides.counterpartyId ?? null };
  const ports: CounterpartyFormSavePorts = {
    getDraft: () => draft,
    getMode: () => overrides.mode ?? "create",
    getCounterpartyId: () => counterpartyId.current,
    setCounterpartyId: (id) => {
      counterpartyId.current = id;
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
        return Promise.resolve({ id: COUNTERPARTY_ID });
      }),
    retry:
      overrides.retry ??
      (() => {
        calls.push("retry");
        return Promise.resolve({ id: COUNTERPARTY_ID });
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
    counterpartyId,
    getFieldErrors: () => fieldErrors,
  };
}

describe("runCounterpartyFormSave", () => {
  it("does not submit when the UI draft is invalid", async () => {
    const { ports, calls, getFieldErrors } = createPorts({
      draft: emptyCounterpartyFormDraft(),
    });
    await runCounterpartyFormSave(ports);
    expect(calls).toEqual([]);
    expect(getFieldErrors().name).toBe("required");
  });

  it("creates, stamps the id, and finishes", async () => {
    const { ports, calls, originDrafts, counterpartyId } = createPorts({});
    await runCounterpartyFormSave(ports);
    expect(counterpartyId.current).toBe(COUNTERPARTY_ID);
    expect(calls).toEqual(["submit:createCounterparty", "reset", "finish"]);
    expect(originDrafts).toHaveLength(1);
  });

  it("retries the in-flight write after a network failure", async () => {
    const input = createCounterpartyPayload(validCreateDraft());
    if (input === null) {
      throw new Error("expected a create payload");
    }
    const write: CounterpartyFormWrite = {
      kind: "createCounterparty",
      input,
    };
    const { ports, calls } = createPorts({
      lastWrite: write,
      lastFailure: { kind: "network", wire: null },
    });
    await runCounterpartyFormSave(ports);
    expect(calls[0]).toBe("retry");
    expect(calls).not.toContain("submit:createCounterparty");
  });

  it("noops an unchanged edit and still finishes", async () => {
    const draft = validCreateDraft();
    const baseline = snapshotFromDraft(draft);
    if (baseline === null) {
      throw new Error("expected a snapshot from a valid draft");
    }
    const { ports, calls, originDrafts } = createPorts({
      mode: "edit",
      counterpartyId: COUNTERPARTY_ID,
      draft,
      baseline,
    });
    await runCounterpartyFormSave(ports);
    expect(calls).toEqual(["finish"]);
    expect(originDrafts).toHaveLength(1);
  });
});
