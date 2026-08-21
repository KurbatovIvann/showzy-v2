import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";

import { isAuthClientError } from "../errors";
import {
  uaNationalFieldDigits,
  uaPhoneFieldValue,
  type AuthChannel,
} from "./identifiers";
import { useSendOtpMutation, useVerifyOtpMutation } from "./mutations";
import { authPolicy } from "./policy";
import {
  initialOtpState,
  otpReducer,
  parseCurrentIdentifier,
  type OtpState,
} from "./reducer";

export type OtpContextValue = {
  readonly state: OtpState;
  readonly setChannel: (channel: AuthChannel) => void;
  readonly setPhoneDigits: (digits: string) => void;
  readonly setEmail: (email: string) => void;
  readonly setCode: (code: string) => void;
  readonly submitIdentifier: () => void;
  readonly submitCode: (code?: string) => void;
  readonly resend: () => void;
  readonly back: () => void;
  readonly phoneDigits: string;
};

const OtpContext = createContext<OtpContextValue | null>(null);

export function OtpProvider({ children }: { readonly children: ReactNode }) {
  const [state, dispatch] = useReducer(otpReducer, undefined, initialOtpState);
  const send = useSendOtpMutation();
  const verify = useVerifyOtpMutation();

  const setChannel = useCallback((channel: AuthChannel) => {
    dispatch({ type: "setChannel", channel });
  }, []);

  const setPhoneDigits = useCallback((digits: string) => {
    dispatch({ type: "setPhone", phone: uaPhoneFieldValue(digits) });
  }, []);

  const setEmail = useCallback((email: string) => {
    dispatch({ type: "setEmail", email });
  }, []);

  const setCode = useCallback((code: string) => {
    dispatch({ type: "setCode", code });
  }, []);

  const submitIdentifier = useCallback(() => {
    if (state.step !== "identifier" || state.busy) {
      return;
    }
    const identifier = parseCurrentIdentifier(state);
    if (identifier === null) {
      dispatch({ type: "identifierInvalid" });
      return;
    }
    dispatch({ type: "sendStart" });
    void send
      .mutateAsync(identifier)
      .then(() => {
        dispatch({
          type: "sendSuccess",
          identifier,
          nowMs: Date.now(),
        });
      })
      .catch((error: unknown) => {
        dispatch({
          type: "sendFailure",
          kind: isAuthClientError(error) ? error.kind : "network",
        });
      });
  }, [send, state]);

  const submitCode = useCallback(
    (codeOverride?: string) => {
      if (state.step !== "verify" || state.busy) {
        return;
      }
      const code = (codeOverride ?? state.code)
        .replaceAll(/\D/g, "")
        .slice(0, authPolicy.otpLength);
      if (code.length !== authPolicy.otpLength) {
        dispatch({ type: "verifyCodeInvalid" });
        return;
      }
      if (codeOverride !== undefined) {
        dispatch({ type: "setCode", code });
      }
      const identifier = state.identifier;
      dispatch({ type: "verifyStart" });
      void verify.mutateAsync({ identifier, code }).catch((error: unknown) => {
        dispatch({
          type: "verifyFailure",
          kind: isAuthClientError(error) ? error.kind : "network",
        });
      });
    },
    [state, verify],
  );

  const resend = useCallback(() => {
    if (state.step !== "verify" || state.busy || state.resendBusy) {
      return;
    }
    if (Date.now() < state.resendAvailableAtMs) {
      return;
    }
    const identifier = state.identifier;
    dispatch({ type: "resendStart" });
    void send
      .mutateAsync(identifier)
      .then(() => {
        dispatch({
          type: "sendSuccess",
          identifier,
          nowMs: Date.now(),
        });
      })
      .catch((error: unknown) => {
        dispatch({
          type: "sendFailure",
          kind: isAuthClientError(error) ? error.kind : "network",
        });
      });
  }, [send, state]);

  const back = useCallback(() => {
    dispatch({ type: "back" });
  }, []);

  const phoneDigits =
    state.step === "identifier" ? uaNationalFieldDigits(state.phone) : "";

  const value = useMemo(
    (): OtpContextValue => ({
      state,
      setChannel,
      setPhoneDigits,
      setEmail,
      setCode,
      submitIdentifier,
      submitCode,
      resend,
      back,
      phoneDigits,
    }),
    [
      state,
      setChannel,
      setPhoneDigits,
      setEmail,
      setCode,
      submitIdentifier,
      submitCode,
      resend,
      back,
      phoneDigits,
    ],
  );

  return <OtpContext.Provider value={value}>{children}</OtpContext.Provider>;
}

export function useOtp(): OtpContextValue {
  const value = useContext(OtpContext);
  if (value === null) {
    throw new Error("useOtp must be used within OtpProvider");
  }
  return value;
}
