import { describe, expect, it } from "vitest";

import { emptyFieldErrors } from "./customer-form.schema";
import {
  emptyCustomerFormDraft,
  snapshotFromDraft,
  type CustomerFormDraft,
  type CustomerFormFieldErrors,
  type CustomerFormMode,
  type CustomerFormSnapshot,
} from "./customer-form-draft";
import {
  createCustomerPayload,
  type CustomerFormMutationResult,
  type CustomerFormWrite,
} from "./customer-form-plan";
import {
  runCustomerFormSave,
  type LastWriteFailure,
  type CustomerFormSavePorts,
} from "./customer-form-save";

const CUSTOMER_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";

function validCreateDraft(): CustomerFormDraft {
  return {
    ...emptyCustomerFormDraft(),
    name: "Марія",
    phone: "+38067",
  };
}

function createPorts(overrides: {
  readonly draft?: CustomerFormDraft;
  readonly mode?: CustomerFormMode;
  readonly customerId?: string | null;
  readonly baseline?: CustomerFormSnapshot | null;
  readonly submit?: (
    write: CustomerFormWrite,
  ) => Promise<CustomerFormMutationResult>;
  readonly retry?: () => Promise<CustomerFormMutationResult>;
  readonly lastFailure?: LastWriteFailure;
  readonly lastWrite?: CustomerFormWrite | null;
}) {
  const calls: string[] = [];
  const originDrafts: CustomerFormDraft[] = [];
  let draft = overrides.draft ?? validCreateDraft();
  let baseline: CustomerFormSnapshot | null = overrides.baseline ?? null;
  let lastWrite = overrides.lastWrite ?? null;
  let lastFailure = overrides.lastFailure ?? { kind: null, wire: null };
  let fieldErrors: CustomerFormFieldErrors = emptyFieldErrors();
  const customerId = { current: overrides.customerId ?? null };
  const ports: CustomerFormSavePorts = {
    getDraft: () => draft,
    getMode: () => overrides.mode ?? "create",
    getCustomerId: () => customerId.current,
    setCustomerId: (id) => {
      customerId.current = id;
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
        return Promise.resolve({ id: CUSTOMER_ID });
      }),
    retry:
      overrides.retry ??
      (() => {
        calls.push("retry");
        return Promise.resolve({ id: CUSTOMER_ID });
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
    customerId,
    getFieldErrors: () => fieldErrors,
  };
}

describe("runCustomerFormSave", () => {
  it("does not submit when the UI draft is invalid", async () => {
    const { ports, calls, getFieldErrors } = createPorts({
      draft: emptyCustomerFormDraft(),
    });
    await runCustomerFormSave(ports);
    expect(calls).toEqual([]);
    expect(getFieldErrors().name).toBe("required");
    expect(getFieldErrors().contact).toBe("required");
  });

  it("creates, stamps the id, and finishes", async () => {
    const { ports, calls, originDrafts, customerId } = createPorts({});
    await runCustomerFormSave(ports);
    expect(customerId.current).toBe(CUSTOMER_ID);
    expect(calls).toEqual(["submit:createCustomer", "reset", "finish"]);
    expect(originDrafts).toHaveLength(1);
  });

  it("retries the in-flight write after a network failure", async () => {
    const input = createCustomerPayload(validCreateDraft());
    if (input === null) {
      throw new Error("expected a create payload");
    }
    const write: CustomerFormWrite = {
      kind: "createCustomer",
      input,
    };
    const { ports, calls } = createPorts({
      lastWrite: write,
      lastFailure: { kind: "network", wire: null },
    });
    await runCustomerFormSave(ports);
    expect(calls[0]).toBe("retry");
    expect(calls).not.toContain("submit:createCustomer");
  });

  it("noops an unchanged edit and still finishes", async () => {
    const draft = validCreateDraft();
    const baseline = snapshotFromDraft(draft);
    if (baseline === null) {
      throw new Error("expected a snapshot from a valid draft");
    }
    const { ports, calls, originDrafts } = createPorts({
      mode: "edit",
      customerId: CUSTOMER_ID,
      draft,
      baseline,
    });
    await runCustomerFormSave(ports);
    expect(calls).toEqual(["finish"]);
    expect(originDrafts).toHaveLength(1);
  });
});
