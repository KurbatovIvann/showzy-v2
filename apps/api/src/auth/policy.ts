/**
 * Authentication policy parameters from docs/specs/security-operations.md §2.
 * Single source of truth: the better-auth options factory (`options.ts`) and
 * the OTP send guard consume these, and tests assert against them. Values
 * change only through spec rework — never ad hoc.
 */
export const sessionPolicy = {
  /** Sliding session lifetime (better-auth `expiresIn`). */
  expiresInSeconds: 60 * 60 * 24 * 7,
  /**
   * Refresh `expiresAt` when the remaining lifetime is shorter than
   * `expiresIn - updateAge` (better-auth default: bump after 1 day of age).
   */
  updateAgeSeconds: 60 * 60 * 24,
} as const;

/** Expo app scheme (`apps/mobile/app.config.ts`). Origin checks, not a grant. */
export const expoClientPolicy = {
  scheme: "showzy",
  origin: "showzy://",
} as const;

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
 * Cookie attributes for browser and Expo sessions (security-operations §2).
 * Expo persists the same cookies in SecureStore via `@better-auth/expo`.
 * The `bearer` plugin remains for non-RN callers (tests, future APIs).
 */
export const cookiePolicy = {
  /** `Secure` in every environment, not only production. */
  secure: true,
  httpOnly: true,
  sameSite: "lax",
} as const;
