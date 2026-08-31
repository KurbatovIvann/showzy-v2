import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";

import {
  dispatchOtpSession,
  resendOtp,
  submitOtpCode,
  submitOtpIdentifier,
  type OtpActionPorts,
} from "./actions";
import {
  uaNationalFieldDigits,
  uaPhoneFieldValue,
  type AuthChannel,
} from "./identifiers";
import { useSendOtpMutation, useVerifyOtpMutation } from "./mutations";
import {
  initialOtpState,
  otpReducer,
  type OtpAction,
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

  const stateRef = useRef(state);
  stateRef.current = state;
  const sendRef = useRef(send.mutateAsync);
  sendRef.current = send.mutateAsync;
  const verifyRef = useRef(verify.mutateAsync);
  verifyRef.current = verify.mutateAsync;

  // I/O ports read stateRef in the same tick as send.
  // Do not switch to dispatch-only: a second submit would miss busy.
  const dispatchOtp = useCallback((action: OtpAction) => {
    stateRef.current = dispatchOtpSession(stateRef.current, action);
    dispatch(action);
  }, []);

  const portsRef = useRef<OtpActionPorts>({
    getState: () => stateRef.current,
    dispatch: (action) => {
      dispatchOtp(action);
    },
    send: (identifier) => sendRef.current(identifier),
    verify: (input) => verifyRef.current(input),
    nowMs: () => Date.now(),
  });

  const setChannel = useCallback(
    (channel: AuthChannel) => {
      dispatchOtp({ type: "setChannel", channel });
    },
    [dispatchOtp],
  );

  const setPhoneDigits = useCallback(
    (digits: string) => {
      dispatchOtp({ type: "setPhone", phone: uaPhoneFieldValue(digits) });
    },
    [dispatchOtp],
  );

  const setEmail = useCallback(
    (email: string) => {
      dispatchOtp({ type: "setEmail", email });
    },
    [dispatchOtp],
  );

  const setCode = useCallback(
    (code: string) => {
      dispatchOtp({ type: "setCode", code });
    },
    [dispatchOtp],
  );

  const submitIdentifier = useCallback(() => {
    void submitOtpIdentifier(portsRef.current);
  }, []);

  const submitCode = useCallback((code?: string) => {
    void submitOtpCode(portsRef.current, code);
  }, []);

  const resend = useCallback(() => {
    void resendOtp(portsRef.current);
  }, []);

  const back = useCallback(() => {
    dispatchOtp({ type: "back" });
  }, [dispatchOtp]);

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
