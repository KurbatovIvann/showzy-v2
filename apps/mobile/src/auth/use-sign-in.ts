import { useOtp } from "./otp/provider";
import { signInSubmitDisabled } from "./auth-submit";
import { useAuthSession } from "./session-provider";
import { errorCopy } from "../i18n/auth";
import type { AuthChannel } from "./otp/identifiers";

export function useSignInScreen() {
  const auth = useAuthSession();
  const otp = useOtp();

  if (otp.state.step !== "identifier") {
    return { kind: "redirect-verify" as const };
  }

  const fieldError =
    otp.state.fieldError === null
      ? null
      : errorCopy(auth.copy, otp.state.fieldError);
  const banner =
    otp.state.bannerError === null
      ? null
      : errorCopy(auth.copy, otp.state.bannerError);

  const channels: ReadonlyArray<{ key: AuthChannel; label: string }> = [
    { key: "phone", label: auth.copy.phone },
    { key: "email", label: auth.copy.email },
  ];

  return {
    kind: "form" as const,
    copy: auth.copy,
    channel: otp.state.channel,
    channels,
    phoneDigits: otp.phoneDigits,
    email: otp.state.email,
    busy: otp.state.busy,
    fieldError,
    banner,
    submitDisabled: signInSubmitDisabled({
      channel: otp.state.channel,
      phoneDigits: otp.phoneDigits,
      email: otp.state.email,
      busy: otp.state.busy,
    }),
    setChannel: otp.setChannel,
    setPhoneDigits: otp.setPhoneDigits,
    setEmail: otp.setEmail,
    submit: otp.submitIdentifier,
  };
}
