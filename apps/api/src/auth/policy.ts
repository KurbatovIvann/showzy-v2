/**
 * Authentication policy parameters from docs/specs/security-operations.md §2.
 * Single source of truth: the better-auth options factory (`options.ts`) and
 * the OTP send guard consume these, and tests assert against them. Values
 * change only through spec rework — never ad hoc.
 */
export const otpPolicy = {
  /** OTP length in digits (better-auth default, kept explicit). */
  length: 6,
  /** OTP codes expire after 5 minutes. */
  expirySeconds: 300,
  /** At most 5 verification attempts per issued code. */
  maxVerifyAttempts: 5,
  /** A resend for the same phone/email no faster than 60 seconds. */
  resendCooldownSeconds: 60,
  /** At most 5 OTP sends per hour per phone/email identifier. */
  maxSendsPerHourPerIdentifier: 5,
  /** At most 20 OTP sends per hour per client IP (better-auth rate limiter). */
  maxSendsPerHourPerIp: 20,
  /** Sliding window backing both per-identifier send limits. */
  sendWindowSeconds: 3600,
} as const;

/**
 * Cookie attributes for web sessions (security-operations §2). Mobile clients
 * use bearer tokens instead (the `bearer` plugin in `options.ts`).
 */
export const cookiePolicy = {
  /** `Secure` in every environment, not only production. */
  secure: true,
  httpOnly: true,
  sameSite: "lax",
} as const;
