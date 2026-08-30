/**
 * DSTU digest OIDs / XML URIs copied from `@showzy/document-signing`
 * `pki/algorithms` so the packer and pipeline stay unit-testable without
 * Nitro. Not a crypto-core rewrite.
 */
export const OID_GOST34311 = "1.2.804.2.1.1.1.1.2.1";
export const OID_DSTU7564_256 = "1.2.804.2.1.1.1.1.2.2.1";
export const OID_DSTU4145_WITH_DSTU7564 = "1.2.804.2.1.1.1.1.3.6";

export const XML_DIGEST_URI_GOST34311 =
  "http://www.w3.org/2001/04/xmlenc#gost34311";
export const XML_DIGEST_URI_KUPYNA256 =
  "http://www.w3.org/2001/04/xmlenc#dstu7564-256";

function oidIsUnder(oid: string, parent: string): boolean {
  return oid === parent || oid.startsWith(`${parent}.`);
}

export function hashOidForCertAlgorithm(algorithm: string): string {
  if (oidIsUnder(algorithm, OID_DSTU4145_WITH_DSTU7564)) {
    return OID_DSTU7564_256;
  }
  return OID_GOST34311;
}

export function xmlDigestUriForHashOid(hashOid: string): string {
  if (oidIsUnder(hashOid, "1.2.804.2.1.1.1.1.2.2")) {
    return XML_DIGEST_URI_KUPYNA256;
  }
  return XML_DIGEST_URI_GOST34311;
}
