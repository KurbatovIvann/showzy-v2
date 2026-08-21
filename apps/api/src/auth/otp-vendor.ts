/**
 * Shared primitives for live OTP vendor HTTP (auth-T2). Adapters own their
 * request shapes; this file is timeout, errors, and log-safe masking only.
 */
export const OTP_VENDOR_TIMEOUT_MS = 10_000;

export const RESEND_EMAILS_URL = "https://api.resend.com/emails";

export const SMS_FLY_TTL_SECONDS = 60;

const E164 = /^\+[1-9]\d{1,14}$/;

export class OtpVendorSendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OtpVendorSendError";
  }
}

export type OtpVendorFetch = (
  url: string,
  init: RequestInit,
) => Promise<Response>;

export type OtpVendorLogger = {
  info(obj: Record<string, unknown>, msg: string): void;
  error(obj: Record<string, unknown>, msg: string): void;
};

export interface OtpTransportRuntime {
  readonly logger?: OtpVendorLogger | undefined;
  readonly fetch?: OtpVendorFetch | undefined;
  readonly timeoutMs?: number | undefined;
}

/** v1 Resend log mask: keep first/last local character, hide the rest. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (
    local === undefined ||
    local === "" ||
    domain === undefined ||
    domain === ""
  ) {
    return "***";
  }
  const first = local.slice(0, 1);
  const last = local.slice(-1);
  const maskedLocal = local.length > 2 ? `${first}***${last}` : "***";
  return `${maskedLocal}@${domain}`;
}

/** v1 SMS log mask. Callers pass E.164; this does not guess a country code. */
export function maskPhone(phone: string): string {
  if (phone.length < 8) {
    return "***";
  }
  return `${phone.slice(0, 6)}****${phone.slice(-2)}`;
}

/**
 * SMS Fly wants digits without `+`. Mobile already sends E.164 (`+380…`);
 * reject anything else rather than porting v1's prepend-380 helper.
 */
export function e164Digits(phone: string): string {
  if (!E164.test(phone)) {
    throw new OtpVendorSendError("SMS recipient is not E.164");
  }
  return phone.slice(1);
}

export function vendorFetch(): OtpVendorFetch {
  return (url, init) => globalThis.fetch(url, init);
}

export function isTimeoutError(error: unknown): boolean {
  return (
    errorName(error) === "TimeoutError" || errorName(error) === "AbortError"
  );
}

export function throwVendorFetchFailure(
  vendor: "Resend" | "SMS Fly",
  error: unknown,
): never {
  if (isTimeoutError(error)) {
    throw new OtpVendorSendError(`${vendor} request timed out`);
  }
  throw new OtpVendorSendError(`${vendor} request failed`);
}

export async function readJsonObject(
  response: Response,
  vendor: "Resend" | "SMS Fly",
): Promise<Record<string, unknown>> {
  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    throw new OtpVendorSendError(`${vendor} returned a non-JSON body`);
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new OtpVendorSendError(`${vendor} returned an unexpected payload`);
  }
  return Object.fromEntries(Object.entries(parsed));
}

export async function drainBody(response: Response): Promise<void> {
  try {
    await response.arrayBuffer();
  } catch {
    // Body may already be consumed or cancelled; ignore.
  }
}

function errorName(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }
  if (!("name" in error) || typeof error.name !== "string") {
    return undefined;
  }
  return error.name;
}
