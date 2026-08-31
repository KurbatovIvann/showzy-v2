import { describe, expect, it } from "vitest";

import { runFormSave } from "../../../components/form-kit/run-form-save";
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
  applyWriteSuccess,
  parseThenPlanCompanyLegalFormSave,
  updateLegalPayload,
  type CompanyLegalFormMutationResult,
  type CompanyLegalFormWrite,
} from "./company-legal-form-plan";
import type { LastWriteFailure } from "../../../components/form-kit/last-write-failure";

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
  const finished: Array<CompanyLegalFormMutationResult | null> = [];
  let draft = overrides.draft ?? validAddDraft();
  let baseline: CompanyLegalFormSnapshot | null = overrides.baseline ?? null;
  let lastWrite = overrides.lastWrite ?? null;
  let lastFailure = overrides.lastFailure ?? { kind: null, wire: null };
  let fieldErrors: CompanyLegalFormFieldErrors = emptyFieldErrors();
  const mode = overrides.mode ?? "add";

  async function run(): Promise<void> {
    await runFormSave({
      plan: () =>
        parseThenPlanCompanyLegalFormSave({
          mode,
          draft,
          baseline,
          lastWrite,
          lastFailureKind: lastFailure.kind,
          lastWireCode: lastFailure.wire,
        }),
      getDraft: () => draft,
      setOrigin: (next) => {
        originDrafts.push(next);
      },
      getLastWrite: () => lastWrite,
      setLastWrite: (write) => {
        lastWrite = write;
      },
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
      applySuccess: ({ draft: next }) => {
        const applied = applyWriteSuccess({ draft: next });
        draft = applied.draft;
        baseline = applied.baseline;
        calls.push("apply");
      },
      finish: (result) => {
        finished.push(result);
        calls.push(result === null ? "finish:null" : `finish:${result.id}`);
        return Promise.resolve();
      },
    });
  }

  return {
    run,
    calls,
    originDrafts,
    finished,
    getBaseline: () => baseline,
    getFieldErrors: () => fieldErrors,
  };
}

describe("company legal form via runFormSave", () => {
  it("does not submit when the UI draft is invalid", async () => {
    const { run, calls, getFieldErrors } = createPorts({
      draft: emptyCompanyLegalFormDraft(),
    });
    await run();
    expect(calls).toEqual([]);
    expect(getFieldErrors().legalName).toBe("required");
  });

  it("adds requisites, stamps the baseline, resets, then finishes with the result", async () => {
    const { run, calls, originDrafts, finished, getBaseline } = createPorts({});
    await run();
    expect(getBaseline()).toEqual(snapshotFromDraft(validAddDraft()));
    expect(calls).toEqual([
      "submit:updateLegal",
      "apply",
      "reset",
      `finish:${COMPANY_ID}`,
    ]);
    expect(finished).toEqual([{ id: COMPANY_ID }]);
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
    const { run, calls } = createPorts({
      lastWrite: write,
      lastFailure: { kind: "network", wire: null },
    });
    await run();
    expect(calls[0]).toBe("retry");
    expect(calls).not.toContain("submit:updateLegal");
  });

  it("noops an unchanged edit and still finishes", async () => {
    const draft = validAddDraft();
    const baseline = snapshotFromDraft(draft);
    if (baseline === null) {
      throw new Error("expected a snapshot from a valid draft");
    }
    const { run, calls, originDrafts, finished } = createPorts({
      mode: "edit",
      draft,
      baseline,
    });
    await run();
    expect(calls).toEqual(["finish:null"]);
    expect(finished).toEqual([null]);
    expect(originDrafts).toHaveLength(1);
  });
});
