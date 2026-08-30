import { describe, expect, it } from "vitest";

import { isAllowedSigningKeyName, signingKeyFileName } from "./signing-key";

describe("signingKeyFileName", () => {
  it("keeps the basename and rejects empty names", () => {
    expect(signingKeyFileName("Key-6.dat")).toBe("Key-6.dat");
    expect(signingKeyFileName("/tmp/keys/sign.p12")).toBe("sign.p12");
    expect(signingKeyFileName("C:\\\\keys\\\\owner.pfx")).toBe("owner.pfx");
    expect(signingKeyFileName("  ")).toBeNull();
    expect(signingKeyFileName(null)).toBeNull();
  });
});

describe("isAllowedSigningKeyName", () => {
  it("accepts canvas Key-6.dat / pfx / p12 / pk8 / jks", () => {
    expect(isAllowedSigningKeyName("Key-6.dat")).toBe(true);
    expect(isAllowedSigningKeyName("owner.pfx")).toBe(true);
    expect(isAllowedSigningKeyName("owner.P12")).toBe(true);
    expect(isAllowedSigningKeyName("key.pk8")).toBe(true);
    expect(isAllowedSigningKeyName("store.jks")).toBe(true);
  });

  it("rejects other extensions", () => {
    expect(isAllowedSigningKeyName("document.pdf")).toBe(false);
    expect(isAllowedSigningKeyName("note.txt")).toBe(false);
    expect(isAllowedSigningKeyName("")).toBe(false);
  });
});
