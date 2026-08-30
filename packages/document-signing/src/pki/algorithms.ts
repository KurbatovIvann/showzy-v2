import { VerifyFailedError } from "../errors.js";

export const OID_DSTU4145_WITH_GOST3411 = "1.2.804.2.1.1.1.1.3.1";
export const OID_DSTU4145_GOST_PB = "1.2.804.2.1.1.1.1.3.1.1";
export const OID_GOST34311 = "1.2.804.2.1.1.1.1.2.1";

export const OID_DSTU4145_WITH_DSTU7564 = "1.2.804.2.1.1.1.1.3.6";
export const OID_DSTU4145_KUPYNA256_PB = "1.2.804.2.1.1.1.1.3.6.1.1";
export const OID_DSTU7564_256 = "1.2.804.2.1.1.1.1.2.2.1";

export const XML_DIGEST_URI_GOST34311 =
  "http://www.w3.org/2001/04/xmlenc#gost34311";

/** CZO ASiC-E + DSTU 7564:2014 CAdES-BES sample (`test.txt.asice`). */
export const XML_DIGEST_URI_KUPYNA256 =
  "http://www.w3.org/2001/04/xmlenc#dstu7564-256";

/** Parse fallback for older or non-CZO GOST manifests. */
export const XML_DIGEST_URI_GOST34311_URN_OID = `urn:oid:${OID_GOST34311}`;

/** Parse fallback for older or non-CZO Kupyna manifests (`testdata/README.md`). */
export const XML_DIGEST_URI_KUPYNA256_URN_OID = `urn:oid:${OID_DSTU7564_256}`;

export function oidIsUnder(oid: string, parent: string): boolean {
  return oid === parent || oid.startsWith(`${parent}.`);
}

export function signingAlgosFromCertAlgorithm(algorithm: string): {
  signAlgo: typeof OID_DSTU4145_GOST_PB | typeof OID_DSTU4145_KUPYNA256_PB;
  digestAlgo: typeof OID_GOST34311 | typeof OID_DSTU7564_256;
} {
  if (oidIsUnder(algorithm, OID_DSTU4145_WITH_DSTU7564)) {
    return {
      signAlgo: OID_DSTU4145_KUPYNA256_PB,
      digestAlgo: OID_DSTU7564_256,
    };
  }
  return {
    signAlgo: OID_DSTU4145_GOST_PB,
    digestAlgo: OID_GOST34311,
  };
}

export function resolveSignParams(
  certAlgorithm: string,
  overrides?: { signAlgo?: string; digestAlgo?: string },
): { signAlgo: string; digestAlgo: string } {
  const inferred = signingAlgosFromCertAlgorithm(certAlgorithm);
  return {
    signAlgo: overrides?.signAlgo ?? inferred.signAlgo,
    digestAlgo: overrides?.digestAlgo ?? inferred.digestAlgo,
  };
}

export function xmlDigestUriForHashOid(hashOid: string): string {
  if (oidIsUnder(hashOid, "1.2.804.2.1.1.1.1.2.2")) {
    return XML_DIGEST_URI_KUPYNA256;
  }
  return XML_DIGEST_URI_GOST34311;
}

export function hashOidFromDigestUri(uri: string): string {
  switch (uri.trim()) {
    case XML_DIGEST_URI_GOST34311:
    case XML_DIGEST_URI_GOST34311_URN_OID:
      return OID_GOST34311;
    case XML_DIGEST_URI_KUPYNA256:
    case XML_DIGEST_URI_KUPYNA256_URN_OID:
      return OID_DSTU7564_256;
    default:
      throw new VerifyFailedError(
        `Unsupported ASiC DigestMethod Algorithm URI: ${uri}`,
      );
  }
}
