import { describe, expect, it } from "vitest";

import {
  hashOidForCertAlgorithm,
  OID_DSTU4145_WITH_DSTU7564,
  OID_DSTU7564_256,
  OID_GOST34311,
  xmlDigestUriForHashOid,
  XML_DIGEST_URI_GOST34311,
  XML_DIGEST_URI_KUPYNA256,
} from "./signing-algorithms";
import {
  buildAsicManifestXml,
  crc32,
  packSignedAsicE,
  packStoredAsicE,
  SigningAsicPackError,
} from "./signing-asic-pack";
import {
  ASIC_MANIFEST_NAME,
  SIGNING_MIME_TYPE,
  SIGNING_PAYLOAD_NAME,
} from "./signing-limits";

describe("crc32", () => {
  it("matches the IEEE ZIP CRC of an empty buffer and of '123456789'", () => {
    expect(crc32(new Uint8Array())).toBe(0);
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });
});

describe("packStoredAsicE", () => {
  it("stores mimetype first uncompressed with an empty extra field", () => {
    const packed = packStoredAsicE([
      {
        name: "mimetype",
        bytes: new TextEncoder().encode(SIGNING_MIME_TYPE),
      },
      { name: SIGNING_PAYLOAD_NAME, bytes: new TextEncoder().encode("%PDF") },
    ]);
    expect(packed[0]).toBe(0x50);
    expect(packed[1]).toBe(0x4b);
    expect(packed[2]).toBe(0x03);
    expect(packed[3]).toBe(0x04);
    const method = (packed[8] ?? 0) | ((packed[9] ?? 0) << 8);
    const extra = (packed[28] ?? 0) | ((packed[29] ?? 0) << 8);
    const nameLen = (packed[26] ?? 0) | ((packed[27] ?? 0) << 8);
    expect(method).toBe(0);
    expect(extra).toBe(0);
    expect(new TextDecoder().decode(packed.subarray(30, 30 + nameLen))).toBe(
      "mimetype",
    );
  });

  it("rejects a missing or wrong mimetype", () => {
    expect(() =>
      packStoredAsicE([
        { name: SIGNING_PAYLOAD_NAME, bytes: new Uint8Array(1) },
      ]),
    ).toThrow(SigningAsicPackError);
    expect(() =>
      packStoredAsicE([
        {
          name: "mimetype",
          bytes: new TextEncoder().encode("application/zip"),
        },
      ]),
    ).toThrow(SigningAsicPackError);
  });
});

describe("packSignedAsicE", () => {
  it("embeds the payload name, manifest, and signature entries", () => {
    const packed = packSignedAsicE({
      payload: new TextEncoder().encode("%PDF-1.4"),
      digestUri: XML_DIGEST_URI_GOST34311,
      digestB64: "YWJjZA==",
      signature: new Uint8Array([0x30, 0x01]),
    });
    const asText = new TextDecoder("latin1").decode(packed);
    expect(asText).toContain(SIGNING_PAYLOAD_NAME);
    expect(asText).toContain(ASIC_MANIFEST_NAME);
    expect(asText).toContain("META-INF/signature001.p7s");
    expect(asText).toContain(SIGNING_MIME_TYPE);
  });
});

describe("buildAsicManifestXml", () => {
  it("points DigestMethod at the DSTU URI and DigestValue at the payload digest", () => {
    const xml = buildAsicManifestXml({
      payloadName: SIGNING_PAYLOAD_NAME,
      digestUri: XML_DIGEST_URI_KUPYNA256,
      digestB64: "ZGlnZXN0",
    });
    expect(xml).toContain(SIGNING_PAYLOAD_NAME);
    expect(xml).toContain(XML_DIGEST_URI_KUPYNA256);
    expect(xml).toContain("ZGlnZXN0");
    expect(xml).not.toContain("sha-256");
  });
});

describe("hashOidForCertAlgorithm", () => {
  it("selects Kupyna for DSTU 7564 certs and GOST otherwise", () => {
    expect(hashOidForCertAlgorithm(OID_DSTU4145_WITH_DSTU7564)).toBe(
      OID_DSTU7564_256,
    );
    expect(hashOidForCertAlgorithm("1.2.804.2.1.1.1.1.3.1.1")).toBe(
      OID_GOST34311,
    );
    expect(xmlDigestUriForHashOid(OID_DSTU7564_256)).toBe(
      XML_DIGEST_URI_KUPYNA256,
    );
    expect(xmlDigestUriForHashOid(OID_GOST34311)).toBe(
      XML_DIGEST_URI_GOST34311,
    );
  });
});
