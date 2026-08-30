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

  it("includes the reviewed QTSP registry snapshot hosts", () => {
    expect(isPkiProxyAllowedHost("csk.ukrsibbank.com")).toBe(true);
    expect(isPkiProxyAllowedHost("ca.vchasno.ua")).toBe(true);
    expect(isPkiProxyAllowedHost("masterkey.ua")).toBe(true);
    expect(isPkiProxyAllowedHost("pki.pumb.ua")).toBe(true);
    expect(isPkiProxyAllowedHost("va1-knedp.ssu.gov.ua")).toBe(true);
    expect(isPkiProxyAllowedHost("qca.ukrgasbank.com")).toBe(true);
  });

  it("rejects hosts outside the static lists (including v1 .ua suffix)", () => {
    expect(isPkiProxyAllowedHost("example.com")).toBe(false);
    expect(isPkiProxyAllowedHost("evil.ua")).toBe(false);
    expect(isPkiProxyAllowedHost("ca.monobank.ua.evil.com")).toBe(false);
    expect(isPkiProxyAllowedHost("evil.masterkey.ua")).toBe(false);
    expect(isPkiProxyAllowedHost("localhost")).toBe(false);
    expect(isPkiProxyAllowedHost("127.0.0.1")).toBe(false);
    expect(isPkiProxyAllowedHost("169.254.169.254")).toBe(false);
    expect(isPkiProxyAllowedHost("metadata.google.internal")).toBe(false);
  });

  it("is derived only from static package data, not from downloaded CAs.json", () => {
    const hostsFromUrls = new Set(
      pkiProxySourceUrls().map((url) => new URL(url).hostname.toLowerCase()),
    );
    for (const host of hostsFromUrls) {
      expect(PKI_PROXY_ALLOWED_HOSTS.has(host)).toBe(true);
    }
    expect(PKI_PROXY_ALLOWED_HOSTS.size).toBeGreaterThan(hostsFromUrls.size);
    for (const host of PKI_PROXY_ALLOWED_HOSTS) {
      expect(host).toBe(host.toLowerCase());
      expect(host).not.toMatch(/^\d{1,3}(?:\.\d{1,3}){3}$/);
      expect(host.endsWith(".")).toBe(false);
    }
  });
});
