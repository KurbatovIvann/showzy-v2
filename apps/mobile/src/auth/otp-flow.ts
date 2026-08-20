import type { AuthApi } from "./http";
import { toAuthClientError, type AuthErrorKind } from "./errors";
import type { AuthChannel, ParsedIdentifier } from "./identifiers";
import { parseIdentifier } from "./identifiers";
import { authPolicy } from "./policy";
import type { SessionController } from "./session";

export type IdentifierStep = {
  readonly step: "identifier";
  readonly channel: AuthChannel;
  readonly phone: string;
  readonly email: string;
  readonly fieldError: AuthErrorKind | null;
  readonly bannerError: AuthErrorKind | null;
  readonly busy: boolean;
};

export type VerifyStep = {
  readonly step: "verify";
  readonly identifier: ParsedIdentifier;
  readonly code: string;
  readonly codeError: AuthErrorKind | null;
  readonly bannerError: AuthErrorKind | null;
  readonly busy: boolean;
  readonly resendBusy: boolean;
  readonly resendAvailableAtMs: number;
};

export type OtpFlowState = IdentifierStep | VerifyStep;

export interface OtpFlow {
  get(): OtpFlowState;
  subscribe(listener: () => void): () => void;
  setChannel(channel: AuthChannel): void;
  setPhone(phone: string): void;
  setEmail(email: string): void;
  setCode(code: string): void;
  submitIdentifier(): Promise<void>;
  submitCode(): Promise<void>;
  resend(): Promise<void>;
  back(): void;
  reset(): void;
  resendSecondsRemaining(): number;
}

export function createOtpFlow(deps: {
  readonly api: Pick<AuthApi, "sendOtp" | "verifyOtp">;
  readonly session: Pick<SessionController, "completeSignIn">;
  readonly now?: () => number;
}): OtpFlow {
  const now = deps.now ?? Date.now;
  let state: OtpFlowState = initialOtpFlowState();
  const listeners = new Set<() => void>();

  function emit(next: OtpFlowState): void {
    state = next;
    for (const listener of listeners) {
      listener();
    }
  }

  function cooldownUntil(): number {
    return now() + authPolicy.resendCooldownSeconds * 1000;
  }

  return {
    get() {
      return state;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setChannel(channel) {
      if (state.step !== "identifier" || state.busy) {
        return;
      }
      emit({ ...state, channel, fieldError: null, bannerError: null });
    },
    setPhone(phone) {
      if (state.step !== "identifier" || state.busy) {
        return;
      }
      emit({ ...state, phone, fieldError: null });
    },
    setEmail(email) {
      if (state.step !== "identifier" || state.busy) {
        return;
      }
      emit({ ...state, email, fieldError: null });
    },
    setCode(code) {
      if (state.step !== "verify" || state.busy) {
        return;
      }
      const cleaned = code.replaceAll(/\D/g, "").slice(0, authPolicy.otpLength);
      emit({ ...state, code: cleaned, codeError: null });
    },
    async submitIdentifier() {
      if (state.step !== "identifier" || state.busy) {
        return;
      }
      const current = state;
      const raw = current.channel === "phone" ? current.phone : current.email;
      const identifier = parseIdentifier(current.channel, raw);
      if (identifier === null) {
        emit({
          ...current,
          fieldError: "invalid_identifier",
          bannerError: null,
        });
        return;
      }
      emit({ ...current, busy: true, fieldError: null, bannerError: null });
      try {
        await deps.api.sendOtp(identifier);
        emit({
          step: "verify",
          identifier,
          code: "",
          codeError: null,
          bannerError: null,
          busy: false,
          resendBusy: false,
          resendAvailableAtMs: cooldownUntil(),
        });
      } catch (error) {
        const mapped = toAuthClientError(error);
        emit({
          ...current,
          busy: false,
          fieldError: null,
          bannerError: mapped.kind,
        });
      }
    },
    async submitCode() {
      if (state.step !== "verify" || state.busy) {
        return;
      }
      if (state.code.length !== authPolicy.otpLength) {
        emit({ ...state, codeError: "invalid_otp" });
        return;
      }
      emit({ ...state, busy: true, codeError: null, bannerError: null });
      try {
        const token = await deps.api.verifyOtp(state.identifier, state.code);
        await deps.session.completeSignIn(token);
        emit({ ...state, busy: false });
      } catch (error) {
        const mapped = toAuthClientError(error);
        const codeError =
          mapped.kind === "invalid_otp" || mapped.kind === "verify_locked"
            ? mapped.kind
            : null;
        const bannerError = codeError === null ? mapped.kind : null;
        emit({
          ...state,
          busy: false,
          code: mapped.kind === "invalid_otp" ? "" : state.code,
          codeError,
          bannerError,
        });
      }
    },
    async resend() {
      if (state.step !== "verify" || state.busy || state.resendBusy) {
        return;
      }
      if (now() < state.resendAvailableAtMs) {
        return;
      }
      emit({ ...state, resendBusy: true, bannerError: null });
      try {
        await deps.api.sendOtp(state.identifier);
        emit({
          ...state,
          resendBusy: false,
          bannerError: null,
          codeError: null,
          resendAvailableAtMs: cooldownUntil(),
        });
      } catch (error) {
        const mapped = toAuthClientError(error);
        emit({
          ...state,
          resendBusy: false,
          bannerError: mapped.kind,
        });
      }
    },
    back() {
      if (state.step !== "verify" || state.busy) {
        return;
      }
      const identifier = state.identifier;
      emit({
        step: "identifier",
        channel: identifier.channel,
        phone:
          identifier.channel === "phone"
            ? identifier.phoneNumber
            : authPolicy.defaultPhonePrefix,
        email: identifier.channel === "email" ? identifier.email : "",
        fieldError: null,
        bannerError: null,
        busy: false,
      });
    },
    reset() {
      emit(initialOtpFlowState());
    },
    resendSecondsRemaining() {
      if (state.step !== "verify") {
        return 0;
      }
      return Math.max(0, Math.ceil((state.resendAvailableAtMs - now()) / 1000));
    },
  };
}

export function initialOtpFlowState(): IdentifierStep {
  return {
    step: "identifier",
    channel: "phone",
    phone: authPolicy.defaultPhonePrefix,
    email: "",
    fieldError: null,
    bannerError: null,
    busy: false,
  };
}
