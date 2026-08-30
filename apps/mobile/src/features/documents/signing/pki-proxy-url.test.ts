import { describe, expect, it } from "vitest";

import { pkiProxyUrl } from "./pki-proxy-url";

describe("pkiProxyUrl", () => {
  it("appends /pki/proxy to the API origin without a trailing slash", () => {
    expect(pkiProxyUrl("https://api.example.test")).toBe(
      "https://api.example.test/pki/proxy",
    );
    expect(pkiProxyUrl("https://api.example.test/")).toBe(
      "https://api.example.test/pki/proxy",
    );
    expect(pkiProxyUrl("https://api.example.test")).not.toContain("/api/v1/");
  });
});
