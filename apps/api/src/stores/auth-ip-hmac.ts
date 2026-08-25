/**
 * HMAC for Better Auth IP consume keys (SHO-147, variant A).
 *
 * Copies the digest width/algorithm of core's private `rotatingIpHmac`
 * (HMAC-SHA256, hex truncated to 32 chars) but **does not** mix in a 24h
 * rotation index — a rotating digest would mint a fresh 20-send OTP bucket
 * at the window edge. The preimage is the full Better Auth key (`${ip}|${path}`).
 * Do not log the preimage or the IP.
 */
import { createHmac } from "node:crypto";

import { CoreInvariantError } from "@showzy/core/errors";

/**
 * Boot/construction gate — same class as `createRateLimitHook`'s empty-secret
 * invariant. Empty string is a config wiring bug, not a runtime consume miss.
 */
export function requireAuthIpHmacSecret(ipHmacSecret: string): string {
  if (ipHmacSecret.length === 0) {
    throw new CoreInvariantError(
      "auth rate-limit store constructed with an empty ipHmacSecret — config wiring bug",
    );
  }
  return ipHmacSecret;
}

/**
 * Digest stored in Redis / the in-memory map. Never the raw Better Auth key.
 */
export function hmacBetterAuthConsumeKey(
  key: string,
  ipHmacSecret: string,
): string {
  return createHmac("sha256", ipHmacSecret)
    .update(key)
    .digest("hex")
    .slice(0, 32);
}
