import { describe, expect, it } from "vitest";

import { AuthClientError } from "../errors";
import {
  createOtpSessionStore,
  type OtpIoPorts,
  type OtpSessionStore,
} from "./actions";
import { authPolicy } from "./policy";
import {
  initialOtpState,
  type IdentifierStep,
  type VerifyStep,
} from "./reducer";

const PHONE = "+380671112233";
const IDENTIFIER = {
  channel: "phone" as const,
  phoneNumber: PHONE,
};
const CODE = "123456";

function deferred(): {
  readonly promise: Promise<void>;
  readonly resolve: () => void;
  readonly reject: (error: Error) => void;
} {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = () => {
      res();
    };
    reject = (error) => {
      rej(error);
    };
  });
  return { promise, resolve, reject };
}

function createStore(
  overrides: Partial<OtpIoPorts> = {},
  initial?: IdentifierStep | VerifyStep,
): {
  readonly store: OtpSessionStore;
  readonly sent: ParsedSend[];
  readonly verified: ParsedVerify[];
} {
  const sent: ParsedSend[] = [];
  const verified: ParsedVerify[] = [];
  const store = createOtpSessionStore(
    {
      send: (identifier) => {
        sent.push(identifier);
        return Promise.resolve();
      },
      verify: (input) => {
        verified.push(input);
        return Promise.resolve();
      },
      nowMs: () => 1_000,
      ...overrides,
    },
    initial,
  );
  return { store, sent, verified };
}

type ParsedSend = Parameters<OtpIoPorts["send"]>[0];
type ParsedVerify = Parameters<OtpIoPorts["verify"]>[0];

function identifierReady(): IdentifierStep {
  return {
    ...initialOtpState(),
    phone: PHONE,
  };
}

function verifyReady(nowMs = 1_000, code = ""): VerifyStep {
  return {
    step: "verify",
    identifier: IDENTIFIER,
    code,
    codeError: null,
    bannerError: null,
    busy: false,
    resendBusy: false,
    resendAvailableAtMs: nowMs + authPolicy.resendCooldownSeconds * 1000,
  };
}

describe("otp session store", () => {
  it("sends the latest identifier, not a stale field snapshot", () => {
    const { store, sent } = createStore();
    store.dispatch({ type: "setPhone", phone: "+380" });
    store.dispatch({ type: "setPhone", phone: PHONE });
    void store.submitIdentifier();
    expect(sent).toEqual([IDENTIFIER]);
    expect(store.getState().busy).toBe(true);
  });

  it("ignores a second submit in the same tick once busy", () => {
    const hang = deferred();
    const sent: ParsedSend[] = [];
    const store = createOtpSessionStore(
      {
        send: (identifier) => {
          sent.push(identifier);
          return hang.promise;
        },
        verify: () => Promise.resolve(),
        nowMs: () => 1_000,
      },
      identifierReady(),
    );
    void store.submitIdentifier();
    void store.submitIdentifier();
    expect(sent).toEqual([IDENTIFIER]);
    expect(store.getState().busy).toBe(true);
    hang.resolve();
  });

  it("rejects a malformed identifier without calling send", () => {
    const { store, sent } = createStore();
    store.dispatch({ type: "setPhone", phone: "67" });
    void store.submitIdentifier();
    expect(sent).toEqual([]);
    const state = store.getState();
    expect(state.step).toBe("identifier");
    if (state.step !== "identifier") {
      throw new Error("expected identifier step");
    }
    expect(state.fieldError).toBe("invalid_identifier");
    expect(state.busy).toBe(false);
  });

  it("maps a typed send failure onto the identifier banner", async () => {
    const { store } = createStore(
      {
        send: () => Promise.reject(new AuthClientError("resend_limited")),
      },
      identifierReady(),
    );
    await store.submitIdentifier();
    const state = store.getState();
    expect(state.step).toBe("identifier");
    if (state.step !== "identifier") {
      throw new Error("expected identifier step");
    }
    expect(state.bannerError).toBe("resend_limited");
    expect(state.busy).toBe(false);
  });

  it("maps an unknown send failure to network", async () => {
    const { store } = createStore(
      {
        send: () => Promise.reject(new Error("boom")),
      },
      identifierReady(),
    );
    await store.submitIdentifier();
    const state = store.getState();
    expect(state.step).toBe("identifier");
    if (state.step !== "identifier") {
      throw new Error("expected identifier step");
    }
    expect(state.bannerError).toBe("network");
  });

  it("reads the latest code on verify and ignores a second submit", () => {
    const hang = deferred();
    const verified: ParsedVerify[] = [];
    const store = createOtpSessionStore(
      {
        send: () => Promise.resolve(),
        verify: (input) => {
          verified.push(input);
          return hang.promise;
        },
        nowMs: () => 1_000,
      },
      verifyReady(1_000, "000000"),
    );
    store.dispatch({ type: "setCode", code: CODE });
    void store.submitCode();
    void store.submitCode();
    expect(verified).toEqual([{ identifier: IDENTIFIER, code: CODE }]);
    expect(store.getState().busy).toBe(true);
    hang.resolve();
  });

  it("moves to verify after send resolves", async () => {
    const { store } = createStore({}, identifierReady());
    await store.submitIdentifier();
    expect(store.getState().step).toBe("verify");
  });

  it("accepts a code override without waiting for a later render", () => {
    const { store, verified } = createStore({}, verifyReady());
    void store.submitCode(CODE);
    expect(verified).toEqual([{ identifier: IDENTIFIER, code: CODE }]);
    const state = store.getState();
    expect(state.step).toBe("verify");
    if (state.step !== "verify") {
      throw new Error("expected verify step");
    }
    expect(state.code).toBe(CODE);
    expect(state.busy).toBe(true);
  });

  it("rejects a short code without calling verify", () => {
    const { store, verified } = createStore({}, verifyReady(1_000, "12"));
    void store.submitCode();
    expect(verified).toEqual([]);
    const state = store.getState();
    expect(state.step).toBe("verify");
    if (state.step !== "verify") {
      throw new Error("expected verify step");
    }
    expect(state.codeError).toBe("invalid_otp");
  });

  it("holds resend until the cooldown elapses, then reads the same identifier", async () => {
    let nowMs = 1_000;
    const sent: ParsedSend[] = [];
    const store = createOtpSessionStore(
      {
        send: (identifier) => {
          sent.push(identifier);
          return Promise.resolve();
        },
        verify: () => Promise.resolve(),
        nowMs: () => nowMs,
      },
      verifyReady(1_000),
    );
    void store.resend();
    expect(sent).toEqual([]);
    const before = store.getState();
    expect(before.step).toBe("verify");
    if (before.step !== "verify") {
      throw new Error("expected verify step");
    }
    expect(before.resendBusy).toBe(false);

    nowMs = 1_000 + authPolicy.resendCooldownSeconds * 1000;
    const resendDone = store.resend();
    const during = store.getState();
    expect(sent).toEqual([IDENTIFIER]);
    expect(during.step).toBe("verify");
    if (during.step !== "verify") {
      throw new Error("expected verify step");
    }
    expect(during.resendBusy).toBe(true);
    await resendDone;
    const after = store.getState();
    expect(after.step).toBe("verify");
    if (after.step !== "verify") {
      throw new Error("expected verify step");
    }
    expect(after.resendBusy).toBe(false);
  });

  it("maps a typed resend failure onto the verify banner", async () => {
    const { store } = createStore(
      {
        send: () => Promise.reject(new AuthClientError("resend_limited")),
        nowMs: () => 61_000,
      },
      verifyReady(1_000),
    );
    await store.resend();
    const state = store.getState();
    expect(state.step).toBe("verify");
    if (state.step !== "verify") {
      throw new Error("expected verify step");
    }
    expect(state.bannerError).toBe("resend_limited");
    expect(state.resendBusy).toBe(false);
  });
});
