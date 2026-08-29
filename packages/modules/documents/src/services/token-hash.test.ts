import { describe, expect, it } from "vitest";

import {
  generateDocumentShareToken,
  hashDocumentShareToken,
} from "./token-hash.js";

describe("document share token hash", () => {
  it("hashes SHA-256 to 64 lowercase hex characters", () => {
    const hash = hashDocumentShareToken("kit-share-token-a");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashDocumentShareToken("kit-share-token-a"));
    expect(hash).not.toBe(hashDocumentShareToken("kit-share-token-b"));
  });

  it("mints a 32-byte base64url secret", () => {
    const token = generateDocumentShareToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(token, "base64url").byteLength).toBe(32);
    expect(token).not.toBe(generateDocumentShareToken());
  });
});
