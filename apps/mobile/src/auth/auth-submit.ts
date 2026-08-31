import type { AuthChannel } from "./otp/identifiers";

export function signInSubmitDisabled(input: {
  readonly channel: AuthChannel;
  readonly phoneDigits: string;
  readonly email: string;
  readonly busy: boolean;
}): boolean {
  const identifierEmpty =
    input.channel === "phone"
      ? input.phoneDigits.length === 0
      : input.email.trim().length === 0;
  return identifierEmpty || input.busy;
}

export function verifySubmitDisabled(input: {
  readonly code: string;
  readonly busy: boolean;
  readonly locked: boolean;
}): boolean {
  return input.code.length === 0 || input.busy || input.locked;
}
