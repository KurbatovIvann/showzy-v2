import { describe, expect, it } from "vitest";

import {
  runFormSave,
  type FormSavePlan,
  type FormSavePorts,
} from "./run-form-save";

type Draft = { readonly name: string };
type Write = { readonly kind: "save"; readonly name: string };
type Result = { readonly id: string };
type FieldErrors = { readonly name: string | null };

const RESULT: Result = { id: "0f0e2d5c-4a1b-4c3d-9e8f-102938475601" };

function createPorts(overrides: {
  readonly plan: FormSavePlan<Write, FieldErrors>;
  readonly lastWrite?: Write | null;
  readonly submit?: (write: Write) => Promise<Result>;
  readonly retry?: () => Promise<Result>;
  readonly applySuccess?: FormSavePorts<
    Draft,
    Write,
    Result,
    FieldErrors
  >["applySuccess"];
}) {
  const calls: string[] = [];
  const finished: Array<Result | null> = [];
  const originDrafts: Draft[] = [];
  let lastWrite = overrides.lastWrite ?? null;
  let fieldErrors: FieldErrors = { name: null };
  const draft: Draft = { name: "ФОП" };
  const ports: FormSavePorts<Draft, Write, Result, FieldErrors> = {
    plan: () => overrides.plan,
    getDraft: () => draft,
    setOrigin: (next) => {
      originDrafts.push(next);
      calls.push("origin");
    },
    getLastWrite: () => lastWrite,
    setLastWrite: (write) => {
      lastWrite = write;
      calls.push(`lastWrite:${write.kind}`);
    },
    setLastFailure: () => undefined,
    setFieldErrors: (errors) => {
      fieldErrors = errors;
      calls.push("fieldErrors");
    },
    submit:
      overrides.submit ??
      ((write) => {
        calls.push(`submit:${write.name}`);
        return Promise.resolve(RESULT);
      }),
    retry:
      overrides.retry ??
      (() => {
        calls.push("retry");
        return Promise.resolve(RESULT);
      }),
    resetMutation: () => {
      calls.push("reset");
    },
    finish: (result) => {
      finished.push(result);
      calls.push(result === null ? "finish:null" : `finish:${result.id}`);
      return Promise.resolve();
    },
    applySuccess:
      overrides.applySuccess ??
      (() => {
        calls.push("apply");
      }),
  };
  return {
    ports,
    calls,
    finished,
    originDrafts,
    getFieldErrors: () => fieldErrors,
  };
}

describe("runFormSave", () => {
  it("does not submit when the plan is invalid", async () => {
    const { ports, calls, getFieldErrors, finished } = createPorts({
      plan: { kind: "invalid", errors: { name: "required" } },
    });
    await runFormSave(ports);
    expect(calls).toEqual(["fieldErrors"]);
    expect(getFieldErrors().name).toBe("required");
    expect(finished).toEqual([]);
  });

  it("writes, applies, resets, then finishes with the mutate result", async () => {
    const write: Write = { kind: "save", name: "ФОП" };
    const { ports, calls, finished, originDrafts } = createPorts({
      plan: { kind: "write", write },
    });
    await runFormSave(ports);
    expect(calls).toEqual([
      "lastWrite:save",
      "submit:ФОП",
      "apply",
      "reset",
      "origin",
      `finish:${RESULT.id}`,
    ]);
    expect(finished).toEqual([RESULT]);
    expect(originDrafts).toHaveLength(1);
  });

  it("retries the in-flight write instead of submitting a new attempt", async () => {
    const write: Write = { kind: "save", name: "ФОП" };
    const { ports, calls, finished } = createPorts({
      plan: { kind: "retry" },
      lastWrite: write,
    });
    await runFormSave(ports);
    expect(calls[0]).toBe("retry");
    expect(calls).not.toContain("submit:ФОП");
    expect(calls).toEqual([
      "retry",
      "apply",
      "reset",
      "origin",
      `finish:${RESULT.id}`,
    ]);
    expect(finished).toEqual([RESULT]);
  });

  it("noops without mutating, resets nothing, and finishes with null", async () => {
    const { ports, calls, finished, originDrafts } = createPorts({
      plan: { kind: "noop" },
    });
    await runFormSave(ports);
    expect(calls).toEqual(["origin", "finish:null"]);
    expect(finished).toEqual([null]);
    expect(originDrafts).toHaveLength(1);
  });

  it("reuses lastWrite on retry and passes that write into applySuccess", async () => {
    const write: Write = { kind: "save", name: "frozen" };
    const applied: Write[] = [];
    const { ports, calls } = createPorts({
      plan: { kind: "retry" },
      lastWrite: write,
      applySuccess: ({ write: next }) => {
        applied.push(next);
        calls.push("apply");
      },
    });
    await runFormSave(ports);
    expect(applied).toEqual([write]);
    expect(calls).not.toContain("lastWrite:save");
  });

  it("returns without finishing when retry has no lastWrite", async () => {
    const { ports, calls, finished } = createPorts({
      plan: { kind: "retry" },
      lastWrite: null,
    });
    await runFormSave(ports);
    expect(calls).toEqual([]);
    expect(finished).toEqual([]);
  });
});
