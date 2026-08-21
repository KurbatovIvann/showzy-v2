import type { AuthErrorKind } from "../errors";
import {
  parseIdentifier,
  type AuthChannel,
  type ParsedIdentifier,
} from "./identifiers";
import { authPolicy } from "./policy";

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

export type OtpState = IdentifierStep | VerifyStep;

export type OtpAction =
  | { readonly type: "setChannel"; readonly channel: AuthChannel }
  | { readonly type: "setPhone"; readonly phone: string }
  | { readonly type: "setEmail"; readonly email: string }
  | { readonly type: "setCode"; readonly code: string }
  | { readonly type: "identifierInvalid" }
  | { readonly type: "sendStart" }
  | {
      readonly type: "sendSuccess";
      readonly identifier: ParsedIdentifier;
      readonly nowMs: number;
    }
  | { readonly type: "sendFailure"; readonly kind: AuthErrorKind }
  | { readonly type: "verifyStart" }
  | { readonly type: "verifyCodeInvalid" }
  | { readonly type: "verifyFailure"; readonly kind: AuthErrorKind }
  | { readonly type: "resendStart" }
  | { readonly type: "back" }
  | { readonly type: "reset" };

export function initialOtpState(): IdentifierStep {
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

export function otpReducer(state: OtpState, action: OtpAction): OtpState {
  switch (action.type) {
    case "reset":
      return initialOtpState();
    case "setChannel":
      if (state.step !== "identifier" || state.busy) {
        return state;
      }
      return {
        ...state,
        channel: action.channel,
        fieldError: null,
        bannerError: null,
      };
    case "setPhone":
      if (state.step !== "identifier" || state.busy) {
        return state;
      }
      return { ...state, phone: action.phone, fieldError: null };
    case "setEmail":
      if (state.step !== "identifier" || state.busy) {
        return state;
      }
      return { ...state, email: action.email, fieldError: null };
    case "setCode":
      if (state.step !== "verify" || state.busy) {
        return state;
      }
      return {
        ...state,
        code: action.code.replaceAll(/\D/g, "").slice(0, authPolicy.otpLength),
        codeError: null,
      };
    case "identifierInvalid":
      if (state.step !== "identifier" || state.busy) {
        return state;
      }
      return { ...state, fieldError: "invalid_identifier", bannerError: null };
    case "sendStart":
      if (state.step !== "identifier" || state.busy) {
        return state;
      }
      return { ...state, busy: true, fieldError: null, bannerError: null };
    case "sendSuccess":
      if (state.step === "identifier") {
        if (!state.busy) {
          return state;
        }
        return verifyFromSend(action.identifier, action.nowMs);
      }
      if (state.resendBusy) {
        return {
          ...state,
          resendBusy: false,
          bannerError: null,
          codeError: null,
          resendAvailableAtMs: cooldownUntil(action.nowMs),
        };
      }
      return state;
    case "sendFailure":
      if (state.step === "identifier" && state.busy) {
        return {
          ...state,
          busy: false,
          fieldError: null,
          bannerError: action.kind,
        };
      }
      if (state.step === "verify" && state.resendBusy) {
        return { ...state, resendBusy: false, bannerError: action.kind };
      }
      return state;
    case "verifyStart":
      if (state.step !== "verify" || state.busy) {
        return state;
      }
      return { ...state, busy: true, codeError: null, bannerError: null };
    case "verifyCodeInvalid":
      if (state.step !== "verify" || state.busy) {
        return state;
      }
      return { ...state, codeError: "invalid_otp" };
    case "verifyFailure": {
      if (state.step !== "verify" || !state.busy) {
        return state;
      }
      const codeError =
        action.kind === "invalid_otp" || action.kind === "verify_locked"
          ? action.kind
          : null;
      return {
        ...state,
        busy: false,
        code: action.kind === "invalid_otp" ? "" : state.code,
        codeError,
        bannerError: codeError === null ? action.kind : null,
      };
    }
    case "resendStart":
      if (state.step !== "verify" || state.busy || state.resendBusy) {
        return state;
      }
      return { ...state, resendBusy: true, bannerError: null };
    case "back":
      if (state.step !== "verify" || state.busy) {
        return state;
      }
      return identifierFromVerify(state.identifier);
  }
}

export function parseCurrentIdentifier(
  state: IdentifierStep,
): ParsedIdentifier | null {
  const raw = state.channel === "phone" ? state.phone : state.email;
  return parseIdentifier(state.channel, raw);
}

export function resendSecondsRemaining(state: OtpState, nowMs: number): number {
  if (state.step !== "verify") {
    return 0;
  }
  return Math.max(0, Math.ceil((state.resendAvailableAtMs - nowMs) / 1000));
}

function cooldownUntil(nowMs: number): number {
  return nowMs + authPolicy.resendCooldownSeconds * 1000;
}

function verifyFromSend(
  identifier: ParsedIdentifier,
  nowMs: number,
): VerifyStep {
  return {
    step: "verify",
    identifier,
    code: "",
    codeError: null,
    bannerError: null,
    busy: false,
    resendBusy: false,
    resendAvailableAtMs: cooldownUntil(nowMs),
  };
}

function identifierFromVerify(identifier: ParsedIdentifier): IdentifierStep {
  return {
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
  };
}
