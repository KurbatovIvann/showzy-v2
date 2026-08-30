/**
 * Signing-sheet session (SHO-260). `reduceSigningSession` owns picker
 * chrome, password field, and pipeline phase. Key bytes stay in a hook
 * ref — never on this state, never logged. Password is local like OTP
 * code and is cleared on close / success.
 */
export type SigningPhase =
  | "idle"
  | "ready"
  | "starting"
  | "downloading"
  | "digesting"
  | "signing"
  | "uploading"
  | "completing"
  | "success"
  | "failed";

export type SigningBannerKey =
  | "password"
  | "validation"
  | "permission"
  | "network"
  | "offline"
  | "unavailable"
  | "native"
  | "key";

export type SigningSessionContext = {
  readonly visible: boolean;
  readonly documentId: string | null;
  readonly documentNumber: string | null;
  readonly fileName: string | null;
  readonly password: string;
  readonly phase: SigningPhase;
  readonly progress: number;
  readonly banner: SigningBannerKey | null;
  readonly certCommonName: string | null;
};

export type SigningSessionEvent =
  | {
      readonly type: "open";
      readonly documentId: string;
      readonly documentNumber: string;
    }
  | { readonly type: "hide" }
  | { readonly type: "hidden" }
  | { readonly type: "setFileName"; readonly fileName: string }
  | { readonly type: "clearFile" }
  | { readonly type: "setPassword"; readonly password: string }
  | { readonly type: "begin" }
  | { readonly type: "phase"; readonly phase: SigningPhase }
  | { readonly type: "setCertCommonName"; readonly commonName: string }
  | { readonly type: "succeed" }
  | { readonly type: "fail"; readonly banner: SigningBannerKey }
  | { readonly type: "clearBanner" };

export const IDLE_SIGNING_SESSION: SigningSessionContext = {
  visible: false,
  documentId: null,
  documentNumber: null,
  fileName: null,
  password: "",
  phase: "idle",
  progress: 0,
  banner: null,
  certCommonName: null,
};

function progressFor(phase: SigningPhase): number {
  switch (phase) {
    case "idle":
      return 0;
    case "ready":
      return 0;
    case "starting":
      return 0.08;
    case "downloading":
      return 0.2;
    case "digesting":
      return 0.4;
    case "signing":
      return 0.55;
    case "uploading":
      return 0.78;
    case "completing":
      return 0.92;
    case "success":
      return 1;
    case "failed":
      return 0;
  }
}

function isBusy(phase: SigningPhase): boolean {
  return (
    phase === "starting" ||
    phase === "downloading" ||
    phase === "digesting" ||
    phase === "signing" ||
    phase === "uploading" ||
    phase === "completing"
  );
}

export function reduceSigningSession(
  context: SigningSessionContext,
  event: SigningSessionEvent,
): SigningSessionContext {
  switch (event.type) {
    case "open":
      return {
        ...IDLE_SIGNING_SESSION,
        visible: true,
        documentId: event.documentId,
        documentNumber: event.documentNumber,
      };
    case "hide":
      if (!context.visible) {
        return context;
      }
      return { ...context, visible: false };
    case "hidden":
      if (context.visible) {
        return context;
      }
      return IDLE_SIGNING_SESSION;
    case "setFileName":
      if (!context.visible || isBusy(context.phase)) {
        return context;
      }
      return {
        ...context,
        fileName: event.fileName,
        phase: "ready",
        banner: null,
      };
    case "clearFile":
      if (!context.visible || isBusy(context.phase)) {
        return context;
      }
      return {
        ...context,
        fileName: null,
        phase: "idle",
        certCommonName: null,
      };
    case "setPassword":
      if (!context.visible || isBusy(context.phase)) {
        return context;
      }
      return { ...context, password: event.password, banner: null };
    case "begin":
      if (
        !context.visible ||
        context.documentId === null ||
        context.fileName === null ||
        context.password.length === 0 ||
        isBusy(context.phase)
      ) {
        return context;
      }
      return {
        ...context,
        phase: "starting",
        progress: progressFor("starting"),
        banner: null,
      };
    case "phase":
      if (!isBusy(context.phase) && context.phase !== "starting") {
        return context;
      }
      return {
        ...context,
        phase: event.phase,
        progress: progressFor(event.phase),
      };
    case "setCertCommonName":
      return { ...context, certCommonName: event.commonName };
    case "succeed":
      return {
        ...context,
        phase: "success",
        progress: 1,
        password: "",
        banner: null,
        visible: false,
      };
    case "fail":
      return {
        ...context,
        phase: "failed",
        progress: 0,
        banner: event.banner,
      };
    case "clearBanner":
      return { ...context, banner: null };
  }
}

export function signingSessionCanSubmit(
  context: SigningSessionContext,
): boolean {
  return (
    context.visible &&
    context.documentId !== null &&
    context.fileName !== null &&
    context.password.length > 0 &&
    !isBusy(context.phase) &&
    context.phase !== "success"
  );
}

export function signingSessionIsBusy(context: SigningSessionContext): boolean {
  return isBusy(context.phase);
}

export function createSigningSessionStore(): {
  readonly getContext: () => SigningSessionContext;
  readonly send: (event: SigningSessionEvent) => void;
} {
  let context = IDLE_SIGNING_SESSION;
  return {
    getContext: () => context,
    send: (event) => {
      context = reduceSigningSession(context, event);
    },
  };
}
