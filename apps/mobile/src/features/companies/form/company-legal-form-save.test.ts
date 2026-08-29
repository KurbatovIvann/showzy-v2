import { describe, expect, it } from "vitest";

import { emptyFieldErrors } from "./company-legal-form.schema";
import {
  emptyCompanyLegalFormDraft,
  snapshotFromDraft,
  type CompanyLegalFormDraft,
  type CompanyLegalFormFieldErrors,
  type CompanyLegalFormMode,
  type CompanyLegalFormSnapshot,
} from "./company-legal-form-draft";
import {
  updateLegalPayload,
  type CompanyLegalFormMutationResult,
  type CompanyLegalFormWrite,
} from "./company-legal-form-plan";
import {
  runCompanyLegalFormSave,
  type LastWriteFailure,
  type CompanyLegalFormSavePorts,
} from "./company-legal-form-save";

const COMPANY_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";

function validAddDraft(): CompanyLegalFormDraft {
  return {
    ...emptyCompanyLegalFormDraft(),
    legalName: "ФОП Іваненко",
  };
}

function createPorts(overrides: {
  readonly draft?: CompanyLegalFormDraft;
  readonly mode?: CompanyLegalFormMode;
  readonly baseline?: CompanyLegalFormSnapshot | null;
  readonly submit?: (
    write: CompanyLegalFormWrite,
  ) => Promise<CompanyLegalFormMutationResult>;
  readonly retry?: () => Promise<CompanyLegalFormMutationResult>;
  readonly lastFailure?: LastWriteFailure;
  readonly lastWrite?: CompanyLegalFormWrite | null;
}) {
  const calls: string[] = [];
  const originDrafts: CompanyLegalFormDraft[] = [];
  let draft = overrides.draft ?? validAddDraft();
  let baseline: CompanyLegalFormSnapshot | null = overrides.baseline ?? null;
  let lastWrite = overrides.lastWrite ?? null;
  let lastFailure = overrides.lastFailure ?? { kind: null, wire: null };
  let fieldErrors: CompanyLegalFormFieldErrors = emptyFieldErrors();
  const ports: CompanyLegalFormSavePorts = {
    getDraft: () => draft,
    getMode: () => overrides.mode ?? "add",
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
        return Promise.resolve({ id: COMPANY_ID });
      }),
    retry:
      overrides.retry ??
      (() => {
        calls.push("retry");
        return Promise.resolve({ id: COMPANY_ID });
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
    getBaseline: () => baseline,
    getFieldErrors: () => fieldErrors,
  };
}

describe("runCompanyLegalFormSave", () => {
  it("does not submit when the UI draft is invalid", async () => {
    const { ports, calls, getFieldErrors } = createPorts({
      draft: emptyCompanyLegalFormDraft(),
    });
    await runCompanyLegalFormSave(ports);
    expect(calls).toEqual([]);
    expect(getFieldErrors().legalName).toBe("required");
  });

  it("adds requisites, stamps the baseline, and finishes", async () => {
    const { ports, calls, originDrafts, getBaseline } = createPorts({});
    await runCompanyLegalFormSave(ports);
    expect(getBaseline()).toEqual(snapshotFromDraft(validAddDraft()));
    expect(calls).toEqual(["submit:updateLegal", "reset", "finish"]);
    expect(originDrafts).toHaveLength(1);
  });

  it("retries the in-flight write after a network failure", async () => {
    const input = updateLegalPayload(validAddDraft());
    if (input === null) {
      throw new Error("expected an updateLegal payload");
    }
    const write: CompanyLegalFormWrite = {
      kind: "updateLegal",
      input,
    };
    const { ports, calls } = createPorts({
      lastWrite: write,
      lastFailure: { kind: "network", wire: null },
    });
    await runCompanyLegalFormSave(ports);
    expect(calls[0]).toBe("retry");
    expect(calls).not.toContain("submit:updateLegal");
  });

  it("noops an unchanged edit and still finishes", async () => {
    const draft = validAddDraft();
    const baseline = snapshotFromDraft(draft);
    if (baseline === null) {
      throw new Error("expected a snapshot from a valid draft");
    }
    const { ports, calls, originDrafts } = createPorts({
      mode: "edit",
      draft,
      baseline,
    });
    await runCompanyLegalFormSave(ports);
    expect(calls).toEqual(["finish"]);
    expect(originDrafts).toHaveLength(1);
  });
});
