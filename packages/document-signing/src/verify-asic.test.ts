import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ASIC_E_MIMETYPE, packAsicE, unpackAsicE } from "./asic-container.js";
import { AsicContainerError, VerifyFailedError } from "./errors.js";
import { createNodeAdapter } from "./platform/node-adapter.js";
import { createSignedAsicE, sha256Hex, verifyAsicE } from "./verify-asic.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const GOST_P12 = join(packageRoot, "cpp/test/data/test-diia.p12");
const encoder = new TextEncoder();
const payload = {
  name: "document.pdf",
  bytes: encoder.encode("%PDF-1.4\nfixture-payload\n%%EOF\n"),
};

describe("verify ASiC-E (GOST fixture CAdES-BES STRUCT)", () => {
  const adapter = createNodeAdapter();

  beforeAll(async () => {
    if (!existsSync(GOST_P12)) {
      throw new Error(`Missing GOST fixture: ${GOST_P12}`);
    }
    await adapter.initialize({});
  });

  afterAll(async () => {
    await adapter.destroy();
  });

  it("signs a container and verifies the payload SHA-256 plus redacted cert", async () => {
    const signed = await createSignedAsicE(payload, adapter);
    expect(signed.payloadSha256).toBe(sha256Hex(payload.bytes));
    const verified = await verifyAsicE(signed.bytes, adapter);
    expect(verified.payloadSha256).toBe(signed.payloadSha256);
    expect(verified.signerCn.length).toBeGreaterThan(0);
    expect(verified.signerTaxId.length).toBeGreaterThan(0);
    expect(verified.signatureAlg.length).toBeGreaterThan(0);
    expect(verified.signedAt).toEqual(expect.stringMatching(/^\d{4}-/));
    expect(JSON.stringify(verified)).not.toContain("p7s");
    expect(JSON.stringify(verified)).not.toMatch(/[A-Za-z0-9+/]{80,}/);
  });

  it("rejects an unsigned ZIP that only claims the ASiC mimetype", async () => {
    const unsigned = packAsicE([
      { name: "mimetype", bytes: encoder.encode(ASIC_E_MIMETYPE) },
      payload,
    ]);
    await expect(verifyAsicE(unsigned, adapter)).rejects.toBeInstanceOf(
      AsicContainerError,
    );
  });

  it("rejects a container whose CAdES does not cover the manifest", async () => {
    const signed = await createSignedAsicE(payload, adapter);
    const unpacked = unpackAsicE(signed.bytes);
    const mutatedXml = `${new TextDecoder().decode(unpacked.manifest.bytes)}\n`;
    const tampered = packAsicE([
      { name: "mimetype", bytes: encoder.encode(ASIC_E_MIMETYPE) },
      payload,
      {
        name: unpacked.manifest.name,
        bytes: new TextEncoder().encode(mutatedXml),
      },
      unpacked.signature,
    ]);
    await expect(verifyAsicE(tampered, adapter)).rejects.toBeInstanceOf(
      VerifyFailedError,
    );
    expect(readFileSync(GOST_P12).byteLength).toBeGreaterThan(0);
  });

  it("rejects intact CAdES with a swapped payload as a manifest digest mismatch, not freeze SHA-256", async () => {
    const signed = await createSignedAsicE(payload, adapter);
    const unpacked = unpackAsicE(signed.bytes);
    const swappedPayload = {
      name: payload.name,
      bytes: encoder.encode("%PDF-1.4\nswapped-payload\n%%EOF\n"),
    };
    expect(sha256Hex(swappedPayload.bytes)).not.toBe(signed.payloadSha256);
    const swapped = packAsicE([
      { name: "mimetype", bytes: encoder.encode(ASIC_E_MIMETYPE) },
      swappedPayload,
      unpacked.manifest,
      unpacked.signature,
    ]);
    const error = await verifyAsicE(swapped, adapter).then(
      () => undefined,
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(VerifyFailedError);
    if (error instanceof VerifyFailedError) {
      expect(error.message).toMatch(/digest|ASiCManifest/i);
      expect(error.message).not.toMatch(/freeze/i);
      expect(error.message).not.toMatch(/sha-256/i);
      expect(error.message).not.toMatch(/payloadSha256/i);
    }
  });

  it("does not pass ignoreCertStatus on production VERIFY STRUCT", () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "verify-asic.ts"),
      "utf8",
    );
    const verifyFn = source.slice(
      source.indexOf("export async function verifyAsicE"),
      source.indexOf("export async function createSignedAsicE"),
    );
    expect(verifyFn).toContain('validationType: "STRUCT"');
    expect(verifyFn).not.toContain("ignoreCertStatus");
    expect(source).toContain("options: { ignoreCertStatus: true }");
  });
});
