import { describe, expect, it } from "vitest";

import { emptyFieldErrors } from "./group-form.schema";
import {
  emptyGroupFormDraft,
  snapshotFromDraft,
  type GroupFormDraft,
  type GroupFormFieldErrors,
  type GroupFormMode,
  type GroupFormSnapshot,
} from "./group-form-draft";
import {
  createGroupPayload,
  type GroupFormMutationResult,
  type GroupFormWrite,
} from "./group-form-plan";
import {
  runGroupFormSave,
  type LastWriteFailure,
  type GroupFormSavePorts,
} from "./group-form-save";

const GROUP_ID = "11111111-1111-4111-8111-111111111111";

function validCreateDraft(): GroupFormDraft {
  return {
    ...emptyGroupFormDraft(),
    name: "Опт",
  };
}

function createPorts(overrides: {
  readonly draft?: GroupFormDraft;
  readonly mode?: GroupFormMode;
  readonly groupId?: string | null;
  readonly baseline?: GroupFormSnapshot | null;
  readonly submit?: (write: GroupFormWrite) => Promise<GroupFormMutationResult>;
  readonly retry?: () => Promise<GroupFormMutationResult>;
  readonly lastFailure?: LastWriteFailure;
  readonly lastWrite?: GroupFormWrite | null;
}) {
  const calls: string[] = [];
  const originDrafts: GroupFormDraft[] = [];
  let draft = overrides.draft ?? validCreateDraft();
  let baseline: GroupFormSnapshot | null = overrides.baseline ?? null;
  let lastWrite = overrides.lastWrite ?? null;
  let lastFailure = overrides.lastFailure ?? { kind: null, wire: null };
  let fieldErrors: GroupFormFieldErrors = emptyFieldErrors();
  const groupId = { current: overrides.groupId ?? null };
  const ports: GroupFormSavePorts = {
    getDraft: () => draft,
    getMode: () => overrides.mode ?? "create",
    getGroupId: () => groupId.current,
    setGroupId: (id) => {
      groupId.current = id;
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
        return Promise.resolve({ id: GROUP_ID });
      }),
    retry:
      overrides.retry ??
      (() => {
        calls.push("retry");
        return Promise.resolve({ id: GROUP_ID });
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
    groupId,
    getFieldErrors: () => fieldErrors,
  };
}

describe("runGroupFormSave", () => {
  it("does not submit when the UI draft is invalid", async () => {
    const { ports, calls, getFieldErrors } = createPorts({
      draft: emptyGroupFormDraft(),
    });
    await runGroupFormSave(ports);
    expect(calls).toEqual([]);
    expect(getFieldErrors().name).toBe("required");
  });

  it("creates, stamps the id, and finishes", async () => {
    const { ports, calls, originDrafts, groupId } = createPorts({});
    await runGroupFormSave(ports);
    expect(groupId.current).toBe(GROUP_ID);
    expect(calls).toEqual(["submit:createGroup", "reset", "finish"]);
    expect(originDrafts).toHaveLength(1);
  });

  it("retries the in-flight write after a network failure", async () => {
    const input = createGroupPayload(validCreateDraft());
    if (input === null) {
      throw new Error("expected a create payload");
    }
    const write: GroupFormWrite = {
      kind: "createGroup",
      input,
    };
    const { ports, calls } = createPorts({
      lastWrite: write,
      lastFailure: { kind: "network", wire: null },
    });
    await runGroupFormSave(ports);
    expect(calls[0]).toBe("retry");
    expect(calls).not.toContain("submit:createGroup");
  });

  it("noops an unchanged edit and still finishes", async () => {
    const draft = validCreateDraft();
    const baseline = snapshotFromDraft(draft);
    if (baseline === null) {
      throw new Error("expected a snapshot from a valid draft");
    }
    const { ports, calls, originDrafts } = createPorts({
      mode: "edit",
      groupId: GROUP_ID,
      draft,
      baseline,
    });
    await runGroupFormSave(ports);
    expect(calls).toEqual(["finish"]);
    expect(originDrafts).toHaveLength(1);
  });
});
