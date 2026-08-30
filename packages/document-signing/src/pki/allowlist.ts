import { pkiProxySourceUrls } from "./ca-registry.js";

function hostnameFromUrl(url: string): string {
  return new URL(url).hostname.toLowerCase();
}

/**
 * Exact hostnames the v2 PKI proxy may contact. Derived from this package's
 * fallback CA table and CZO bundle URLs (OCSP/TSA plus the CMP/cert URLs
 * those same providers already fetch through the proxy).
 */
export const PKI_PROXY_ALLOWED_HOSTS: ReadonlySet<string> = new Set(
  pkiProxySourceUrls().map(hostnameFromUrl),
);

export function isPkiProxyAllowedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return PKI_PROXY_ALLOWED_HOSTS.has(host);
}
