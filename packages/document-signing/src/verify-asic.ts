import { createHash } from "node:crypto";

import { unpackAsicE, type AsicEntry } from "./asic-container.js";
import { VerifyFailedError } from "./errors.js";
import { base64ToUint8, uint8ToBase64 } from "./pki/encoding.js";
import { hashOidFromDigestUri } from "./pki/algorithms.js";
import {
  digestResultSchema,
  parseUapkiResult,
  verifyResultSchema,
  type SignatureInfo,
} from "./pki/uapki-json.js";
import { createNodeAdapter } from "./platform/node-adapter.js";
import type { UapkiAdapter } from "./platform/adapter.js";
import type { UapkiResponse } from "./types.js";

export type AsicVerifyResult = {
  readonly payloadSha256: string;
  readonly signerCn: string;
  readonly signerOrg: string;
  readonly signerTaxId: string;
  readonly signatureAlg: string;
  readonly signedAt: string;
};

let sharedAdapter: Promise<UapkiAdapter> | undefined;
let sharedAdapterGate: Promise<void> = Promise.resolve();

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function getSharedNodeAdapter(): Promise<UapkiAdapter> {
  sharedAdapter ??= (async () => {
    const adapter = createNodeAdapter();
    await adapter.initialize({});
    return adapter;
  })();
  return sharedAdapter;
}

/**
 * Process-global mutex: every verification in this process is serialized
 * through one promise chain. This is deliberate (SHO-282) — the shared
 * UAPKI WASM engine is single-threaded and stateful (OPEN/ADD_CERT/VERIFY
 * mutate engine state), so two interleaved verifications would corrupt
 * each other. If verify throughput ever becomes a bottleneck, the option
 * is a small pool of independent adapters (one WASM instance each), not
 * concurrent calls into this one.
 */
async function withSharedAdapter<T>(
  run: (adapter: UapkiAdapter) => Promise<T>,
): Promise<T> {
  let release: () => void = () => {
    return;
  };
  const previous = sharedAdapterGate;
  sharedAdapterGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await run(await getSharedNodeAdapter());
  } finally {
    release();
  }
}

async function call(
  adapter: UapkiAdapter,
  method: string,
  parameters?: Record<string, unknown>,
): Promise<UapkiResponse> {
  return adapter.process(JSON.stringify({ method, parameters }));
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null) {
    return value as Record<string, unknown>;
  }
  return {};
}

function stringField(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function taxIdFromSubject(subject: Record<string, unknown>): string {
  return (
    stringField(subject, "SERIALNUMBER") ??
    stringField(subject, "serialNumber") ??
    stringField(subject, "OI") ??
    stringField(subject, "10.20.0.1") ??
    stringField(subject, "10.0.1.4.1") ??
    stringField(subject, "192.168.0.2.1.1") ??
    ""
  );
}

function parseCertFields(certResult: Record<string, unknown>): {
  readonly signerCn: string;
  readonly signerOrg: string;
  readonly signerTaxId: string;
  readonly signatureAlg: string;
} {
  const subject = asRecord(certResult.subject);
  const spki = asRecord(certResult.subjectPublicKeyInfo);
  return {
    signerCn: stringField(subject, "CN") ?? "",
    signerOrg: stringField(subject, "O") ?? "",
    signerTaxId: taxIdFromSubject(subject),
    signatureAlg:
      stringField(spki, "algorithm") ??
      (typeof certResult.keyAlgo === "string" ? certResult.keyAlgo : ""),
  };
}

function isoNow(): string {
  return new Date().toISOString();
}

function digestB64Equal(declared: string, actual: string): boolean {
  let left: Uint8Array;
  let right: Uint8Array;
  try {
    left = base64ToUint8(declared);
    right = base64ToUint8(actual);
  } catch {
    return false;
  }
  if (left.byteLength !== right.byteLength) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < left.byteLength; i += 1) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

function payloadManifestDigest(
  xml: string,
  payloadName: string,
): { readonly methodUri: string; readonly digestB64: string } {
  const expected = payloadName.replace(/^\//, "");
  const blocks = xml.matchAll(
    /<asic:DataObjectReference\b([^>]*)>([\s\S]*?)<\/asic:DataObjectReference>/gi,
  );
  for (const block of blocks) {
    const attrs = block[1] ?? "";
    const body = block[2] ?? "";
    const uriMatch = /\bURI="([^"]+)"/i.exec(attrs);
    const uri = uriMatch?.[1]?.replace(/^\//, "");
    if (uri !== expected) {
      continue;
    }
    const methodMatch =
      /<(?:ds:)?DigestMethod\b[^>]*\bAlgorithm="([^"]+)"/i.exec(body);
    const valueMatch =
      /<(?:ds:)?DigestValue>([\s\S]*?)<\/(?:ds:)?DigestValue>/i.exec(body);
    const methodUri = methodMatch?.[1];
    const digestB64 = valueMatch?.[1]?.replace(/\s+/g, "");
    if (
      methodUri === undefined ||
      digestB64 === undefined ||
      digestB64.length === 0
    ) {
      throw new VerifyFailedError(
        "ASiCManifest is missing DigestMethod or DigestValue for the payload",
      );
    }
    return { methodUri, digestB64 };
  }
  throw new VerifyFailedError(
    "ASiCManifest has no DataObjectReference for the payload",
  );
}

async function requireManifestPayloadDigest(
  engine: UapkiAdapter,
  unpacked: {
    readonly payload: AsicEntry;
    readonly manifest: AsicEntry;
  },
): Promise<void> {
  const xml = new TextDecoder().decode(unpacked.manifest.bytes);
  const declared = payloadManifestDigest(xml, unpacked.payload.name);
  const digest = await call(engine, "DIGEST", {
    hashAlgo: hashOidFromDigestUri(declared.methodUri),
    bytes: uint8ToBase64(unpacked.payload.bytes),
  });
  if (digest.errorCode !== 0) {
    throw new VerifyFailedError(
      digest.error ?? `DIGEST failed: ${String(digest.errorCode)}`,
      digest.errorCode,
    );
  }
  const actualB64 = parseUapkiResult(
    digestResultSchema,
    "DIGEST",
    digest.result,
  ).bytes;
  if (actualB64 === undefined) {
    throw new VerifyFailedError("DIGEST returned no bytes");
  }
  if (!digestB64Equal(declared.digestB64, actualB64)) {
    throw new VerifyFailedError(
      "ASiC payload digest does not match ASiCManifest DigestValue",
    );
  }
}

function isoFromUapkiTime(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return new Date(parsed).toISOString();
}

export async function verifyAsicE(
  bytes: Uint8Array,
  adapter?: UapkiAdapter,
): Promise<AsicVerifyResult> {
  if (adapter === undefined) {
    return withSharedAdapter((shared) => verifyAsicE(bytes, shared));
  }
  const unpacked = unpackAsicE(bytes);
  const engine = adapter;
  const verify = await call(engine, "VERIFY", {
    signature: {
      bytes: uint8ToBase64(unpacked.signature.bytes),
      content: uint8ToBase64(unpacked.manifest.bytes),
    },
    validationType: "STRUCT",
  });
  if (verify.errorCode !== 0) {
    throw new VerifyFailedError(
      verify.error ?? `VERIFY failed: ${String(verify.errorCode)}`,
      verify.errorCode,
    );
  }
  const infos = parseUapkiResult(
    verifyResultSchema,
    "VERIFY",
    verify.result,
  ).signatureInfos;
  const first: SignatureInfo | undefined = infos?.[0];
  if (first === undefined || first.statusSignature !== "VALID") {
    const status = first?.statusSignature ?? "missing";
    throw new VerifyFailedError(
      `ASiC signature is not VALID (statusSignature=${status})`,
    );
  }
  if (first.statusMessageDigest !== "VALID") {
    const digestStatus = first.statusMessageDigest ?? "missing";
    throw new VerifyFailedError(
      `ASiC manifest digest is not VALID (statusMessageDigest=${digestStatus})`,
    );
  }

  await requireManifestPayloadDigest(engine, unpacked);

  const certId = first.signerCertId;
  let certResult: Record<string, unknown> = {};
  if (certId !== undefined) {
    const info = await call(engine, "CERT_INFO", { certId });
    if (info.errorCode === 0) {
      certResult = info.result ?? {};
    } else {
      const got = await call(engine, "GET_CERT", { certId });
      const der = stringField(asRecord(got.result), "bytes");
      if (got.errorCode === 0 && der !== undefined) {
        const parsed = await call(engine, "CERT_INFO", { bytes: der });
        if (parsed.errorCode === 0) {
          certResult = parsed.result ?? {};
        }
      }
    }
  }
  const fields = parseCertFields(certResult);
  const signedAt =
    isoFromUapkiTime(first.signingTime) ??
    isoFromUapkiTime(first.bestSignatureTime) ??
    isoNow();
  const signatureAlg = first.signAlgo ?? fields.signatureAlg;

  return {
    payloadSha256: sha256Hex(unpacked.payload.bytes),
    signerCn: fields.signerCn,
    signerOrg: fields.signerOrg,
    signerTaxId: fields.signerTaxId,
    signatureAlg,
    signedAt,
  };
}

export { unpackAsicE };
