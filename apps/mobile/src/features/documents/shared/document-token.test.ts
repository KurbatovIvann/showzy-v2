import { describe, expect, it } from "vitest";

import { uuidFromParam } from "./document-id";
import { shareTokenFromParam } from "./document-token";

const BASE64URL = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ012";

describe("shareTokenFromParam", () => {
  it("accepts a base64url page token and refuses UUID-only parsing", () => {
    expect(shareTokenFromParam(BASE64URL)).toBe(BASE64URL);
    expect(shareTokenFromParam([BASE64URL])).toBe(BASE64URL);
    expect(uuidFromParam(BASE64URL)).toBeNull();
  });

  it("trims, decodes, and refuses empty, oversized, or path-like values", () => {
    expect(shareTokenFromParam(`  ${BASE64URL}  `)).toBe(BASE64URL);
    expect(shareTokenFromParam(encodeURIComponent(BASE64URL))).toBe(BASE64URL);
    expect(shareTokenFromParam(undefined)).toBeNull();
    expect(shareTokenFromParam("")).toBeNull();
    expect(shareTokenFromParam("   ")).toBeNull();
    expect(shareTokenFromParam("a".repeat(129))).toBeNull();
    expect(shareTokenFromParam("abc/def")).toBeNull();
    expect(shareTokenFromParam("abc..def")).toBeNull();
  });
});
