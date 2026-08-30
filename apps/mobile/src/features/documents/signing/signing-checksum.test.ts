import { describe, expect, it } from "vitest";

import { sha256DigestToHex } from "./signing-checksum";

describe("sha256DigestToHex", () => {
  it("encodes bytes as lowercase hex and does not log", () => {
    const hashed = new Uint8Array([0x0a, 0xff]).buffer;
    expect(sha256DigestToHex(hashed)).toBe("0aff");
  });
});
