/**
 * Client-visible auth policy (security-operations §2). Server enforcement
 * lives in `apps/api` (`otpPolicy`); these numbers drive UI only (OTP
 * length, resend countdown). Limits themselves are not reimplemented here.
 */
export const authPolicy = {
  otpLength: 6,
  resendCooldownSeconds: 60,
  defaultPhonePrefix: "+380",
} as const;
