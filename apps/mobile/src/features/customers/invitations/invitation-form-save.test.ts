import { describe, expect, it } from "vitest";

import { emptyFieldErrors } from "./invitation-form.schema";
import {
  emptyInvitationFormDraft,
  type InvitationFormDraft,
  type InvitationFormFieldErrors,
} from "./invitation-form-draft";
import {
  createInvitePayload,
  type InvitationFormMutationResult,
  type InvitationFormWrite,
  type InviteCreateSecret,
} from "./invitation-form-plan";
import {
  runInvitationFormSave,
  type LastWriteFailure,
  type InvitationFormSavePorts,
} from "./invitation-form-save";

const INVITE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SECRET: InviteCreateSecret = {
  id: INVITE_ID,
  token: "plaintext-once",
  url: "showzy:invite/plaintext-once",
};

function validCreateDraft(): InvitationFormDraft {
  return emptyInvitationFormDraft();
}

function createPorts(overrides: {
  readonly draft?: InvitationFormDraft;
  readonly created?: InviteCreateSecret | null;
  readonly submit?: (
    write: InvitationFormWrite,
  ) => Promise<InvitationFormMutationResult>;
  readonly retry?: () => Promise<InvitationFormMutationResult>;
  readonly lastFailure?: LastWriteFailure;
  readonly lastWrite?: InvitationFormWrite | null;
}) {
  const calls: string[] = [];
  const originDrafts: InvitationFormDraft[] = [];
  let draft = overrides.draft ?? validCreateDraft();
  let created = overrides.created ?? null;
  let lastWrite = overrides.lastWrite ?? null;
  let lastFailure = overrides.lastFailure ?? { kind: null, wire: null };
  let fieldErrors: InvitationFormFieldErrors = emptyFieldErrors();
  const ports: InvitationFormSavePorts = {
    getDraft: () => draft,
    getCreated: () => created,
    setCreated: (secret) => {
      created = secret;
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
        return Promise.resolve(SECRET);
      }),
    retry:
      overrides.retry ??
      (() => {
        calls.push("retry");
        return Promise.resolve(SECRET);
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
    getCreated: () => created,
    getFieldErrors: () => fieldErrors,
  };
}

describe("runInvitationFormSave", () => {
  it("does not submit when the UI draft is invalid", async () => {
    const { ports, calls, getFieldErrors } = createPorts({
      draft: { ...validCreateDraft(), expiresAt: "nope" },
    });
    await runInvitationFormSave(ports);
    expect(calls).toEqual([]);
    expect(getFieldErrors().expiresAt).toBe("invalid");
  });

  it("creates, stores the one-time secret, and finishes", async () => {
    const { ports, calls, originDrafts, getCreated } = createPorts({});
    await runInvitationFormSave(ports);
    expect(getCreated()).toEqual(SECRET);
    expect(calls).toEqual(["submit:createInvite", "reset", "finish"]);
    expect(originDrafts).toHaveLength(1);
  });

  it("retries the in-flight write after a network failure", async () => {
    const input = createInvitePayload(validCreateDraft());
    if (input === null) {
      throw new Error("expected a create payload");
    }
    const write: InvitationFormWrite = {
      kind: "createInvite",
      input,
    };
    const { ports, calls } = createPorts({
      lastWrite: write,
      lastFailure: { kind: "network", wire: null },
    });
    await runInvitationFormSave(ports);
    expect(calls[0]).toBe("retry");
    expect(calls).not.toContain("submit:createInvite");
  });

  it("noops after the secret is already shown", async () => {
    const { ports, calls, originDrafts } = createPorts({
      created: SECRET,
    });
    await runInvitationFormSave(ports);
    expect(calls).toEqual(["finish"]);
    expect(originDrafts).toHaveLength(1);
  });
});
