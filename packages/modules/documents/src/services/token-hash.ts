import { createHash, randomBytes } from "node:crypto";

/**
 * SHA-256 hex of the plaintext page-token secret. Same algorithm as
 * `hashInviteToken` / core's `hashShareToken` — implemented here so
 * production action code never imports `@showzy/core/testing`.
 */
export function hashDocumentShareToken(plaintextToken: string): string {
  return createHash("sha256").update(plaintextToken).digest("hex");
}

/** 32-byte URL-safe secret. Never persisted; only the hash is stored. */
export function generateDocumentShareToken(): string {
  return randomBytes(32).toString("base64url");
}
