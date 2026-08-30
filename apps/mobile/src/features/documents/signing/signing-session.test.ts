import { describe, expect, it } from "vitest";

import {
  createSigningSessionStore,
  IDLE_SIGNING_SESSION,
  reduceSigningSession,
  signingSessionCanSubmit,
  type SigningSessionContext,
} from "./signing-session";

const DOCUMENT_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";

function opened(): SigningSessionContext {
  return reduceSigningSession(IDLE_SIGNING_SESSION, {
    type: "open",
    documentId: DOCUMENT_ID,
    documentNumber: "SHZ-РХ-000001",
  });
}

describe("reduceSigningSession", () => {
  it("opens a blank sheet without key bytes or a signed URL", () => {
    const next = opened();
    expect(next.visible).toBe(true);
    expect(next.documentId).toBe(DOCUMENT_ID);
    expect(next.fileName).toBeNull();
    expect(next.password).toBe("");
    expect(JSON.stringify(next)).not.toContain("payloadDownloadUrl");
    expect(JSON.stringify(next)).not.toContain("uploadUrl");
    expect(JSON.stringify(next)).not.toHaveProperty("keyBytes");
  });

  it("keeps the selected document while hide runs, then clears on hidden", () => {
    const ready = reduceSigningSession(opened(), {
      type: "setFileName",
      fileName: "Key-6.dat",
    });
    const withPassword = reduceSigningSession(ready, {
      type: "setPassword",
      password: "secret-once",
    });
    expect(signingSessionCanSubmit(withPassword)).toBe(true);
    const hidden = reduceSigningSession(withPassword, { type: "hide" });
    expect(hidden.visible).toBe(false);
    expect(hidden.documentId).toBe(DOCUMENT_ID);
    expect(reduceSigningSession(hidden, { type: "hidden" })).toEqual(
      IDLE_SIGNING_SESSION,
    );
  });

  it("does not drop a sheet that was reopened before a late hidden", () => {
    const reopened = opened();
    expect(reduceSigningSession(reopened, { type: "hidden" })).toEqual(
      reopened,
    );
  });

  it("clears the password on success and never stores key bytes", () => {
    const store = createSigningSessionStore();
    store.send({
      type: "open",
      documentId: DOCUMENT_ID,
      documentNumber: "SHZ-РХ-000001",
    });
    store.send({ type: "setFileName", fileName: "owner.p12" });
    store.send({ type: "setPassword", password: "secret-once" });
    store.send({ type: "begin" });
    expect(store.getContext().phase).toBe("starting");
    store.send({ type: "succeed" });
    expect(store.getContext().password).toBe("");
    expect(store.getContext().phase).toBe("success");
    expect(store.getContext().visible).toBe(false);
    expect(JSON.stringify(store.getContext())).not.toContain("secret-once");
    expect(store.getContext()).not.toHaveProperty("keyBytes");
  });

  it("blocks password edits while the pipeline is busy", () => {
    let state = opened();
    state = reduceSigningSession(state, {
      type: "setFileName",
      fileName: "owner.p12",
    });
    state = reduceSigningSession(state, {
      type: "setPassword",
      password: "one",
    });
    state = reduceSigningSession(state, { type: "begin" });
    const busy = reduceSigningSession(state, {
      type: "setPassword",
      password: "two",
    });
    expect(busy.password).toBe("one");
    expect(busy.phase).toBe("starting");
  });
});
