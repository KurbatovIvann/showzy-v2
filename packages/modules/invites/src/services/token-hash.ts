import { createHash, randomBytes } from "node:crypto";

/**
 * SHA-256 hex of the plaintext invite secret. Same algorithm as
 * `hashShareToken` in core's share fixture — implemented here so production
 * action code never imports `@showzy/core/testing`.
 */
export function hashInviteToken(plaintextToken: string): string {
  return createHash("sha256").update(plaintextToken).digest("hex");
}

/** 32-byte URL-safe secret. Never persisted; only the hash is stored. */
export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}
