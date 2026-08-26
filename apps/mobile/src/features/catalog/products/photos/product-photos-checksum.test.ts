import { describe, expect, it } from "vitest";

import { sha256DigestToHex } from "./product-photos-checksum";

describe("sha256DigestToHex", () => {
  it("encodes a SHA-256 digest as lowercase hex without a prefix", async () => {
    const bytes = new TextEncoder().encode("abc");
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    expect(sha256DigestToHex(digest)).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
