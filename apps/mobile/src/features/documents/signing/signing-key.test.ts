import { describe, expect, it } from "vitest";

import {
  isAllowedSigningKeyName,
  signingKeyFileName,
  wipeKeyBytes,
} from "./signing-key";

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
    expect(isAllowedSigningKeyName("KEY-6.DAT")).toBe(true);
    expect(isAllowedSigningKeyName("owner.pfx")).toBe(true);
    expect(isAllowedSigningKeyName("owner.P12")).toBe(true);
    expect(isAllowedSigningKeyName("key.pk8")).toBe(true);
    expect(isAllowedSigningKeyName("store.jks")).toBe(true);
  });

  it("rejects other .dat files and other extensions", () => {
    expect(isAllowedSigningKeyName("notes.dat")).toBe(false);
    expect(isAllowedSigningKeyName("secret.dat")).toBe(false);
    expect(isAllowedSigningKeyName("document.pdf")).toBe(false);
    expect(isAllowedSigningKeyName("note.txt")).toBe(false);
    expect(isAllowedSigningKeyName("")).toBe(false);
  });
});

describe("wipeKeyBytes", () => {
  it("overwrites key material in place before the caller nulls the ref", () => {
    const bytes = new Uint8Array([0x30, 0x82, 0x01]);
    wipeKeyBytes(bytes);
    expect(bytes).toEqual(new Uint8Array([0, 0, 0]));
    wipeKeyBytes(null);
  });
});
