import { describe, expect, it } from "vitest";

import {
  assertSafeSigningUrl,
  wrapSigningNetworkFailure,
} from "./signing-network";

describe("assertSafeSigningUrl", () => {
  it("rejects non-http(s) URLs without echoing the value", () => {
    const unsafe = "javascript:alert(1)";
    expect(() => {
      assertSafeSigningUrl(unsafe);
    }).toThrow(TypeError);
    try {
      assertSafeSigningUrl(unsafe);
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(TypeError);
      expect(String(error)).toBe("TypeError: Failed to fetch");
      expect(String(error)).not.toContain("javascript");
    }
  });

  it("accepts http(s)", () => {
    expect(() => {
      assertSafeSigningUrl("https://files.example.invalid/payload.pdf");
    }).not.toThrow();
  });
});

describe("wrapSigningNetworkFailure", () => {
  it("rewrites URL-bearing errors to Failed to fetch", () => {
    const abort = new AbortController();
    const leaked = new Error(
      "PUT https://files.example.invalid/uploads/pending?token=put failed",
    );
    let thrown: unknown;
    try {
      wrapSigningNetworkFailure(leaked, abort.signal);
    } catch (error: unknown) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(TypeError);
    expect(String(thrown)).toBe("TypeError: Failed to fetch");
    expect(String(thrown)).not.toContain("token=");
    expect(String(thrown)).not.toContain("https://");
  });

  it("rethrows AbortError so dismiss still cancels", () => {
    const abort = new AbortController();
    abort.abort();
    const aborted = new Error("aborted");
    aborted.name = "AbortError";
    expect(() => {
      wrapSigningNetworkFailure(aborted, abort.signal);
    }).toThrow(aborted);
  });
});
