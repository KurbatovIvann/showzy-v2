import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { generateInviteToken, hashInviteToken } from "./token-hash.js";

describe("invite token hash", () => {
  it("is SHA-256 hex of the plaintext (same algorithm as hashShareToken)", () => {
    const plaintext = "invite-hash-sample";
    expect(hashInviteToken(plaintext)).toBe(
      createHash("sha256").update(plaintext).digest("hex"),
    );
    expect(hashInviteToken(plaintext)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("mints a URL-safe 32-byte secret", () => {
    const first = generateInviteToken();
    const second = generateInviteToken();
    expect(first).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(first, "base64url").byteLength).toBe(32);
    expect(second).not.toBe(first);
  });
});
