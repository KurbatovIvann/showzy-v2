/**
 * OTP I/O ports (send / verify / resend). `createOtpSessionStore` is the
 * single session source: the provider subscribes with
 * `useSyncExternalStore`; tests drive the same store so a second submit
 * in the same tick sees `busy`.
 */
import { isAuthClientError } from "../errors";
import type { ParsedIdentifier } from "./identifiers";
import { authPolicy } from "./policy";
import {
  initialOtpState,
  otpReducer,
  parseCurrentIdentifier,
  type OtpAction,
  type OtpState,
} from "./reducer";

export type OtpIoPorts = {
  readonly send: (identifier: ParsedIdentifier) => Promise<void>;
  readonly verify: (input: {
    readonly identifier: ParsedIdentifier;
    readonly code: string;
  }) => Promise<void>;
  readonly nowMs: () => number;
};

export type OtpActionPorts = OtpIoPorts & {
  readonly getState: () => OtpState;
  readonly dispatch: (action: OtpAction) => void;
};

export type OtpSessionStore = {
  readonly getState: () => OtpState;
  readonly dispatch: (action: OtpAction) => void;
  readonly subscribe: (listener: () => void) => () => void;
  readonly submitIdentifier: () => Promise<void>;
  readonly submitCode: (code?: string) => Promise<void>;
  readonly resend: () => Promise<void>;
};

export function createOtpSessionStore(
  ports: OtpIoPorts,
  initial: OtpState = initialOtpState(),
): OtpSessionStore {
  let state = initial;
  const listeners = new Set<() => void>();
  const dispatch = (action: OtpAction) => {
    state = otpReducer(state, action);
    for (const listener of [...listeners]) {
      listener();
    }
  };
  const actionPorts: OtpActionPorts = {
    getState: () => state,
    dispatch,
    send: ports.send,
    verify: ports.verify,
    nowMs: ports.nowMs,
  };
  return {
    getState: () => state,
    dispatch,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    submitIdentifier: () => submitOtpIdentifier(actionPorts),
    submitCode: (code) => submitOtpCode(actionPorts, code),
    resend: () => resendOtp(actionPorts),
  };
}

function submitOtpIdentifier(ports: OtpActionPorts): Promise<void> {
  const state = ports.getState();
  if (state.step !== "identifier" || state.busy) {
    return Promise.resolve();
  }
  const identifier = parseCurrentIdentifier(state);
  if (identifier === null) {
    ports.dispatch({ type: "identifierInvalid" });
    return Promise.resolve();
  }
  ports.dispatch({ type: "sendStart" });
  return ports
    .send(identifier)
    .then(() => {
      ports.dispatch({
        type: "sendSuccess",
        identifier,
        nowMs: ports.nowMs(),
      });
    })
    .catch((error: unknown) => {
      ports.dispatch({
        type: "sendFailure",
        kind: isAuthClientError(error) ? error.kind : "network",
      });
    });
}

function submitOtpCode(
  ports: OtpActionPorts,
  codeOverride?: string,
): Promise<void> {
  const state = ports.getState();
  if (state.step !== "verify" || state.busy) {
    return Promise.resolve();
  }
  const code = (codeOverride ?? state.code)
    .replaceAll(/\D/g, "")
    .slice(0, authPolicy.otpLength);
  if (code.length !== authPolicy.otpLength) {
    ports.dispatch({ type: "verifyCodeInvalid" });
    return Promise.resolve();
  }
  if (codeOverride !== undefined) {
    ports.dispatch({ type: "setCode", code });
  }
  const identifier = state.identifier;
  ports.dispatch({ type: "verifyStart" });
  return ports.verify({ identifier, code }).catch((error: unknown) => {
    ports.dispatch({
      type: "verifyFailure",
      kind: isAuthClientError(error) ? error.kind : "network",
    });
  });
}

function resendOtp(ports: OtpActionPorts): Promise<void> {
  const state = ports.getState();
  if (state.step !== "verify" || state.busy || state.resendBusy) {
    return Promise.resolve();
  }
  if (ports.nowMs() < state.resendAvailableAtMs) {
    return Promise.resolve();
  }
  const identifier = state.identifier;
  ports.dispatch({ type: "resendStart" });
  return ports
    .send(identifier)
    .then(() => {
      ports.dispatch({
        type: "sendSuccess",
        identifier,
        nowMs: ports.nowMs(),
      });
    })
    .catch((error: unknown) => {
      ports.dispatch({
        type: "sendFailure",
        kind: isAuthClientError(error) ? error.kind : "network",
      });
    });
}
