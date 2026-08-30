import { describe, expect, it } from "vitest";

import { PKI_PROXY_ALLOWED_HOSTS, isPkiProxyAllowedHost } from "./allowlist.js";
import { pkiProxySourceUrls } from "./ca-registry.js";

describe("PKI proxy allowlist (SHO-255)", () => {
  it("includes OCSP/TSA hosts from the copied fallback CA table", () => {
    expect(isPkiProxyAllowedHost("ca.monobank.ua")).toBe(true);
    expect(isPkiProxyAllowedHost("acsk.privatbank.ua")).toBe(true);
    expect(isPkiProxyAllowedHost("czo.gov.ua")).toBe(true);
    expect(isPkiProxyAllowedHost("ca.tax.gov.ua")).toBe(true);
  });

  it("includes CMP/cert hosts those same providers already fetch through the proxy", () => {
    expect(isPkiProxyAllowedHost("ca.informjust.ua")).toBe(true);
    expect(isPkiProxyAllowedHost("acskidd.gov.ua")).toBe(true);
  });

  it("rejects hosts outside the copied package (including v1 .ua suffix)", () => {
    expect(isPkiProxyAllowedHost("example.com")).toBe(false);
    expect(isPkiProxyAllowedHost("evil.ua")).toBe(false);
    expect(isPkiProxyAllowedHost("ca.monobank.ua.evil.com")).toBe(false);
    expect(isPkiProxyAllowedHost("localhost")).toBe(false);
    expect(isPkiProxyAllowedHost("127.0.0.1")).toBe(false);
    expect(isPkiProxyAllowedHost("169.254.169.254")).toBe(false);
    expect(isPkiProxyAllowedHost("metadata.google.internal")).toBe(false);
  });

  it("is derived only from static package URLs, not from downloaded CAs.json", () => {
    const hostsFromUrls = new Set(
      pkiProxySourceUrls().map((url) => new URL(url).hostname.toLowerCase()),
    );
    expect(PKI_PROXY_ALLOWED_HOSTS).toEqual(hostsFromUrls);
    expect(PKI_PROXY_ALLOWED_HOSTS.size).toBeGreaterThan(0);
    for (const host of PKI_PROXY_ALLOWED_HOSTS) {
      expect(host).not.toMatch(/^\d{1,3}(?:\.\d{1,3}){3}$/);
    }
  });
});
