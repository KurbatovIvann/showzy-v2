import { otpPolicy } from "./policy.js";

/**
 * Storage for OTP send history. The shape matches better-auth's
 * `SecondaryStorage` (get/set with TTL) so the Redis client mounted in
 * fnd-T26 satisfies it directly; tests use an in-memory map.
 */
export interface OtpSendStore {
  get(key: string): Promise<string | null | undefined>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
}

export type OtpChannel = "phone" | "email";

export type OtpSendDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly retryAfterSeconds: number };

export interface OtpSendGuard {
  /**
   * Checks the per-identifier limits (60-second resend cooldown, 5 sends per
   * hour — security-operations §2) and, when allowed, records the send.
   */
  check(channel: OtpChannel, identifier: string): Promise<OtpSendDecision>;
}

export interface CreateOtpSendGuardOptions {
  readonly store: OtpSendStore;
  /** Injectable clock (epoch milliseconds) for tests; defaults to Date.now. */
  readonly now?: () => number;
}

function normalizeIdentifier(channel: OtpChannel, identifier: string): string {
  const trimmed = identifier.trim();
  // Email addresses are case-insensitive identifiers; phone numbers pass
  // through (format validation is the endpoint's concern, not the guard's).
  return channel === "email" ? trimmed.toLowerCase() : trimmed;
}

/**
 * Per-identifier OTP send throttle. better-auth's own rate limiter is keyed
 * by client IP, so the per-phone/per-email limits required by
 * security-operations §2 live here; the guard is wired as a better-auth
 * `hooks.before` middleware in `options.ts`, ahead of OTP creation.
 *
 * The read-modify-write below is not atomic: two racing requests for one
 * identifier may both pass. That is acceptable defense-in-depth on top of the
 * per-IP limits — an atomic Redis variant can replace the store operations
 * later without touching callers.
 */
export function createOtpSendGuard(
  options: CreateOtpSendGuardOptions,
): OtpSendGuard {
  const now = options.now ?? Date.now;

  return {
    async check(channel, identifier) {
      const key = `otp-send:${channel}:${normalizeIdentifier(channel, identifier)}`;
      const nowMs = now();
      const windowStartMs = nowMs - otpPolicy.sendWindowSeconds * 1000;

      const raw = await options.store.get(key);
      const history = raw === null || raw === undefined ? [] : readHistory(raw);
      const recent = history.filter((sentAt) => sentAt > windowStartMs);

      const lastSentAt = recent.at(-1);
      if (lastSentAt !== undefined) {
        const cooldownEndsMs =
          lastSentAt + otpPolicy.resendCooldownSeconds * 1000;
        if (nowMs < cooldownEndsMs) {
          return {
            allowed: false,
            retryAfterSeconds: Math.ceil((cooldownEndsMs - nowMs) / 1000),
          };
        }
      }

      if (recent.length >= otpPolicy.maxSendsPerHourPerIdentifier) {
        // recent is non-empty here, so the oldest entry exists.
        const oldest = recent[0] ?? nowMs;
        const windowFreesMs = oldest + otpPolicy.sendWindowSeconds * 1000;
        return {
          allowed: false,
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((windowFreesMs - nowMs) / 1000),
          ),
        };
      }

      recent.push(nowMs);
      await options.store.set(
        key,
        JSON.stringify(recent),
        otpPolicy.sendWindowSeconds,
      );
      return { allowed: true };
    },
  };
}

/** Parses stored history defensively: corrupt state must never block sign-in. */
function readHistory(raw: string): number[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is number => typeof entry === "number");
  } catch {
    return [];
  }
}
