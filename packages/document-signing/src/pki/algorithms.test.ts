import { describe, expect, it } from "vitest";

import { VerifyFailedError } from "../errors.js";
import {
  OID_DSTU7564_256,
  OID_GOST34311,
  XML_DIGEST_URI_GOST34311,
  XML_DIGEST_URI_GOST34311_URN_OID,
  XML_DIGEST_URI_KUPYNA256,
  XML_DIGEST_URI_KUPYNA256_URN_OID,
  hashOidFromDigestUri,
} from "./algorithms.js";

describe("hashOidFromDigestUri", () => {
  it("maps known ETSI GOST and Kupyna DigestMethod URIs", () => {
    expect(hashOidFromDigestUri(XML_DIGEST_URI_GOST34311)).toBe(OID_GOST34311);
    expect(hashOidFromDigestUri(XML_DIGEST_URI_KUPYNA256)).toBe(
      OID_DSTU7564_256,
    );
  });

  it("maps documented urn:oid parse fallbacks", () => {
    expect(hashOidFromDigestUri(XML_DIGEST_URI_GOST34311_URN_OID)).toBe(
      OID_GOST34311,
    );
    expect(hashOidFromDigestUri(XML_DIGEST_URI_KUPYNA256_URN_OID)).toBe(
      OID_DSTU7564_256,
    );
  });

  it("rejects xmldsig sha256 and sha1 instead of mapping them to GOST 34311", () => {
    const unknownUris = [
      "http://www.w3.org/2000/09/xmldsig#sha256",
      "http://www.w3.org/2000/09/xmldsig#sha1",
      "http://www.w3.org/2001/04/xmlenc#sha256",
    ] as const;
    for (const uri of unknownUris) {
      expect(() => hashOidFromDigestUri(uri)).toThrow(VerifyFailedError);
      expect(() => hashOidFromDigestUri(uri)).toThrow(uri);
    }
  });

  it("rejects substring traps that previously mapped to Kupyna or GOST", () => {
    const traps = [
      "http://evil.example/dstu7564",
      "http://www.w3.org/2000/09/xmldsig#sha256?kupyna",
      "urn:oid:1.2.804.2.1.1.1.1.2.2.1.evil",
    ] as const;
    for (const uri of traps) {
      expect(() => hashOidFromDigestUri(uri)).toThrow(VerifyFailedError);
    }
  });
});
