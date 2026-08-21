import { describe, expect, it } from "vitest";

import {
  composeUaE164,
  identifierDestination,
  isPlaceholderEmail,
  normalizeEmail,
  normalizePhone,
  parseIdentifier,
  stripUaNationalDigits,
} from "./identifiers";

describe("auth identifiers", () => {
  it("accepts E.164 phones and strips grouping", () => {
    expect(parseIdentifier("phone", "+380 67 111 22 33")).toEqual({
      channel: "phone",
      phoneNumber: "+380671112233",
    });
    expect(normalizePhone("+380-67")).toBe("+38067");
    expect(parseIdentifier("phone", "0671112233")).toBeNull();
    expect(parseIdentifier("phone", "+380")).toBeNull();
  });

  it("normalizes email case and rejects empty or malformed values", () => {
    expect(parseIdentifier("email", " User@Example.COM ")).toEqual({
      channel: "email",
      email: "user@example.com",
    });
    expect(normalizeEmail("A@B.C")).toBe("a@b.c");
    expect(parseIdentifier("email", "not-an-email")).toBeNull();
    expect(parseIdentifier("email", "")).toBeNull();
  });

  it("composes and strips UA national digits against +380 E.164", () => {
    expect(composeUaE164("671112233")).toBe("+380671112233");
    expect(composeUaE164("67 111 22 33")).toBe("+380671112233");
    expect(composeUaE164("67111223")).toBeNull();
    expect(composeUaE164("6711122330")).toBeNull();
    expect(composeUaE164("0671112233")).toBeNull();
    expect(stripUaNationalDigits("+380671112233")).toBe("671112233");
    expect(stripUaNationalDigits("+380 67 111 22 33")).toBe("671112233");
    expect(stripUaNationalDigits("+38067")).toBeNull();
    expect(stripUaNationalDigits("671112233")).toBeNull();
  });

  it("hides phone-first placeholder emails from session display", () => {
    expect(isPlaceholderEmail("380671112233@phone.invalid")).toBe(true);
    expect(isPlaceholderEmail("user@example.com")).toBe(false);
    expect(isPlaceholderEmail(null)).toBe(false);
    expect(
      identifierDestination({ channel: "phone", phoneNumber: "+380671112233" }),
    ).toBe("+380671112233");
  });
});
