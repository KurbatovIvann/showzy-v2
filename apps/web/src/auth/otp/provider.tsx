import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { createOtpSessionStore } from "./actions";
import {
  uaNationalFieldDigits,
  uaPhoneFieldValue,
  type AuthChannel,
} from "./identifiers";
import { useSendOtpMutation, useVerifyOtpMutation } from "./mutations";
import type { OtpState } from "./reducer";

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
  const send = useSendOtpMutation();
  const verify = useVerifyOtpMutation();
  const sendRef = useRef(send.mutateAsync);
  sendRef.current = send.mutateAsync;
  const verifyRef = useRef(verify.mutateAsync);
  verifyRef.current = verify.mutateAsync;

  const [store] = useState(() =>
    createOtpSessionStore({
      send: (identifier) => sendRef.current(identifier),
      verify: (input) => verifyRef.current(input),
      nowMs: () => Date.now(),
    }),
  );

  const state = useSyncExternalStore(
    store.subscribe,
    store.getState,
    store.getState,
  );

  const setChannel = useCallback(
    (channel: AuthChannel) => {
      store.dispatch({ type: "setChannel", channel });
    },
    [store],
  );

  const setPhoneDigits = useCallback(
    (digits: string) => {
      store.dispatch({ type: "setPhone", phone: uaPhoneFieldValue(digits) });
    },
    [store],
  );

  const setEmail = useCallback(
    (email: string) => {
      store.dispatch({ type: "setEmail", email });
    },
    [store],
  );

  const setCode = useCallback(
    (code: string) => {
      store.dispatch({ type: "setCode", code });
    },
    [store],
  );

  const submitIdentifier = useCallback(() => {
    void store.submitIdentifier();
  }, [store]);

  const submitCode = useCallback(
    (code?: string) => {
      void store.submitCode(code);
    },
    [store],
  );

  const resend = useCallback(() => {
    void store.resend();
  }, [store]);

  const back = useCallback(() => {
    store.dispatch({ type: "back" });
  }, [store]);

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
