import { errorCopy, verifyMessageParts } from "../i18n/auth";
import { interpolate } from "../i18n/locale";
import { verifySubmitDisabled } from "./auth-submit";
import { identifierDestination } from "./otp/identifiers";
import { authPolicy } from "./otp/policy";
import { useOtp } from "./otp/provider";
import { useAuthSession } from "./session-provider";
import { useCountdown } from "./use-countdown";

export function useVerifyScreen() {
  const auth = useAuthSession();
  const otp = useOtp();
  const targetMs =
    otp.state.step === "verify" ? otp.state.resendAvailableAtMs : null;
  const remaining = useCountdown(targetMs);

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
  const messageTemplate =
    otp.state.identifier.channel === "phone"
      ? auth.copy.verifyPhoneMessage
      : auth.copy.verifyEmailMessage;
  const { before: messageBefore, after: messageAfter } =
    verifyMessageParts(messageTemplate);
  const backLabel =
    otp.state.identifier.channel === "phone"
      ? auth.copy.wrongNumber
      : auth.copy.wrongEmail;

  return {
    kind: "form" as const,
    copy: auth.copy,
    destination,
    messageBefore,
    messageAfter,
    backLabel,
    code: otp.state.code,
    otpLength: authPolicy.otpLength,
    busy: otp.state.busy,
    locked,
    otpError,
    banner,
    submitDisabled: verifySubmitDisabled({
      code: otp.state.code,
      busy: otp.state.busy,
      locked,
    }),
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
