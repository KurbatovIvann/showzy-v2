import { pkiProxySourceUrls } from "./ca-registry.js";

function hostnameFromUrl(url: string): string {
  return new URL(url).hostname.toLowerCase();
}

/**
 * Reviewed static snapshot of every QTSP (КНЕДП) host in the official CZO
 * registry (https://czo.gov.ua/download/certificates/CAs.json, taken
 * 2026-08-30): the `address`, `ocspAccessPointAddress`, `cmpAddress`, and
 * `tspAddress` hostnames of each entry.
 *
 * The proxy must reach these for CMP cert fetch and for OCSP/TSP during
 * CAdES-XL signing with keys from any registered CA. The list is baked in on
 * purpose: the allowlist is never derived from a downloaded CAs.json at
 * runtime (a compromised registry must not mint SSRF targets), and the v1
 * "*.ua suffix" rule stays rejected. To update: re-extract hostnames from
 * CAs.json and review the diff (human-approved deviation from SHO-255's
 * fallback-table-only wording, 2026-08-30).
 */
const KNOWN_QTSP_HOSTS: readonly string[] = [
  "acsk.dpsu.gov.ua",
  "acsk.oree.com.ua",
  "acsk.privatbank.ua",
  "amokey.com.ua",
  "ca.bankalliance.ua",
  "ca.credit-agricole.ua",
  "ca.depositsign.com",
  "ca.e-life.com.ua",
  "ca.edin.ua",
  "ca.gp.gov.ua",
  "ca.informjust.ua",
  "ca.mil.gov.ua",
  "ca.monobank.ua",
  "ca.mvs.gov.ua",
  "ca.ngu.gov.ua",
  "ca.oschadbank.ua",
  "ca.pravex.com.ua",
  "ca.sensebank.com.ua",
  "ca.szru.gov.ua",
  "ca.tascombank.ua",
  "ca.tax.gov.ua",
  "ca.treasury.gov.ua",
  "ca.vchasno.ua",
  "canbu.bank.gov.ua",
  "cesaris.itsway.kiev.ua",
  "cmp.e-life.com.ua",
  "csk.ukrsibbank.com",
  "csk.uss.gov.ua",
  "csk.uz.gov.ua",
  "knedp.ssu.gov.ua",
  "masterkey.ua",
  "ocsp.e-life.com.ua",
  "pki.pumb.ua",
  "qca.ukrgasbank.com",
  "tsp.e-life.com.ua",
  "uakey.com.ua",
  "va1-knedp.ssu.gov.ua",
];

/**
 * PKI infrastructure hosts that are not QTSP (КНЕДП) entries in CAs.json but
 * appear in the AIA/OCSP/TSP URLs of certificate chains issued under them.
 * Reviewed individually, same exact-host rule as above.
 */
const KNOWN_PKI_INFRASTRUCTURE_HOSTS: readonly string[] = [
  // Засвідчувальний центр НБУ — roots the bank QTSPs; bank-issued signer
  // chains reference it for OCSP during CAdES-XL signing (observed 2026-08-30).
  "zc.bank.gov.ua",
];

/**
 * Exact hostnames the v2 PKI proxy may contact: this package's fallback CA
 * table and CZO bundle URLs, plus the reviewed QTSP registry snapshot above.
 * Exact-host matching only — no suffix rules, no IP literals.
 */
export const PKI_PROXY_ALLOWED_HOSTS: ReadonlySet<string> = new Set([
  ...pkiProxySourceUrls().map(hostnameFromUrl),
  ...KNOWN_QTSP_HOSTS,
  ...KNOWN_PKI_INFRASTRUCTURE_HOSTS,
]);

export function isPkiProxyAllowedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return PKI_PROXY_ALLOWED_HOSTS.has(host);
}
