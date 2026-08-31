import { useEffect, useState } from "react";

import { errorCopy, verifyMessage } from "../i18n/auth";
import { interpolate } from "../i18n/locale";
import { identifierDestination } from "./otp/identifiers";
import { authPolicy } from "./otp/policy";
import { useOtp } from "./otp/provider";
import { resendSecondsRemaining } from "./otp/reducer";
import { useAuthSession } from "./session-provider";

export function useVerifyScreen() {
  const auth = useAuthSession();
  const otp = useOtp();
  // Re-render once a second so `resendSecondsRemaining` is recomputed
  // without putting `Date.now()` in a reactive store.
  const [, setTick] = useState(0);

  const remaining = resendSecondsRemaining(otp.state, Date.now());
  const countdownActive = otp.state.step === "verify" && remaining > 0;

  useEffect(() => {
    if (!countdownActive) {
      return;
    }
    const id = setInterval(() => {
      setTick((value) => value + 1);
    }, 1000);
    return () => {
      clearInterval(id);
    };
  }, [countdownActive]);

  if (otp.state.step !== "verify") {
    return { kind: "redirect-sign-in" as const };
  }

  const destination = identifierDestination(otp.state.identifier);
  const locked = otp.state.codeError === "verify_locked";
  const otpError =
    otp.state.codeError === null
      ? null
      : errorCopy(auth.copy, otp.state.codeError);
  const banner =
    otp.state.bannerError === null
      ? null
      : errorCopy(auth.copy, otp.state.bannerError);
  const backLabel =
    otp.state.identifier.channel === "phone"
      ? auth.copy.wrongNumber
      : auth.copy.wrongEmail;

  return {
    kind: "form" as const,
    copy: auth.copy,
    message: verifyMessage(
      auth.copy,
      otp.state.identifier.channel,
      destination,
    ),
    backLabel,
    code: otp.state.code,
    otpLength: authPolicy.otpLength,
    digitLabel: (n: number) =>
      interpolate(auth.copy.otpDigit, { n: String(n) }),
    busy: otp.state.busy,
    locked,
    otpError,
    banner,
    submitDisabled: otp.state.code.length === 0 || otp.state.busy || locked,
    remaining,
    resendBusy: otp.state.resendBusy,
    resendWaitLabel:
      remaining > 0
        ? interpolate(auth.copy.resendCodeIn, {
            seconds: String(remaining),
          })
        : null,
    setCode: otp.setCode,
    submit: otp.submitCode,
    resend: otp.resend,
    back: otp.back,
  };
}
