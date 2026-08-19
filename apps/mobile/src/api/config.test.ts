import { describe, expect, it } from "vitest";

import { apiUrlFromEnv, MobileConfigError, resolveApiUrl } from "./config";

describe("EXPO_PUBLIC_API_URL", () => {
  it("returns the origin without a trailing slash", () => {
    expect(resolveApiUrl("http://localhost:3000/")).toBe(
      "http://localhost:3000",
    );
    expect(resolveApiUrl("https://api.example.com")).toBe(
      "https://api.example.com",
    );
  });

  it("treats missing and empty values as unset", () => {
    expect(() => resolveApiUrl(undefined)).toThrow(MobileConfigError);
    expect(() => resolveApiUrl("")).toThrow(MobileConfigError);
    expect(() => resolveApiUrl("   ")).toThrow(MobileConfigError);
    expect(() => apiUrlFromEnv({})).toThrow(MobileConfigError);
    expect(() => apiUrlFromEnv({ EXPO_PUBLIC_API_URL: "" })).toThrow(
      MobileConfigError,
    );
  });
});
