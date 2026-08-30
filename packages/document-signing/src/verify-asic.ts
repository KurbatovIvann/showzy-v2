import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { packAsicE, unpackAsicE, type AsicEntry } from "./asic-container.js";
import { VerifyFailedError } from "./errors.js";
import { base64ToUint8, uint8ToBase64 } from "./pki/encoding.js";
import {
  OID_GOST34311,
  resolveSignParams,
  xmlDigestUriForHashOid,
} from "./pki/algorithms.js";
import { createNodeAdapter } from "./platform/node-adapter.js";
import type { UapkiAdapter } from "./platform/adapter.js";
import type { UapkiResponse } from "./types.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const GOST_P12 = join(packageRoot, "cpp/test/data/test-diia.p12");
const GOST_PASSWORD = "testpassword";

export type AsicVerifyResult = {
  readonly payloadSha256: string;
  readonly signerCn: string;
  readonly signerOrg: string;
  readonly signerTaxId: string;
  readonly signatureAlg: string;
  readonly signedAt: string;
};

type SignatureInfo = {
  readonly statusSignature?: unknown;
  readonly statusMessageDigest?: unknown;
  readonly signerCertId?: unknown;
  readonly signAlgo?: unknown;
  readonly signingTime?: unknown;
  readonly bestSignatureTime?: unknown;
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
    stringField(subject, "serialNumber") ??
    stringField(subject, "SN") ??
    stringField(subject, "10.0.1.4.1") ??
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
  const infos = verify.result?.signatureInfos;
  const first = Array.isArray(infos)
    ? (infos[0] as SignatureInfo | undefined)
    : undefined;
  if (first === undefined || first.statusSignature !== "VALID") {
    const status =
      typeof first?.statusSignature === "string"
        ? first.statusSignature
        : "missing";
    throw new VerifyFailedError(
      `ASiC signature is not VALID (statusSignature=${status})`,
    );
  }
  if (
    first.statusMessageDigest !== undefined &&
    first.statusMessageDigest !== "VALID"
  ) {
    const digestStatus =
      typeof first.statusMessageDigest === "string"
        ? first.statusMessageDigest
        : "invalid";
    throw new VerifyFailedError(
      `ASiC manifest digest is not VALID (statusMessageDigest=${digestStatus})`,
    );
  }

  const certId =
    typeof first.signerCertId === "string" ? first.signerCertId : undefined;
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
  const signatureAlg =
    (typeof first.signAlgo === "string" ? first.signAlgo : undefined) ??
    fields.signatureAlg;

  return {
    payloadSha256: sha256Hex(unpacked.payload.bytes),
    signerCn: fields.signerCn,
    signerOrg: fields.signerOrg,
    signerTaxId: fields.signerTaxId,
    signatureAlg,
    signedAt,
  };
}

async function addFixtureCerts(adapter: UapkiAdapter): Promise<void> {
  const certDir = join(packageRoot, "cpp/test/data/certs");
  const names = [
    "CAO-05E19E2CD92EA2990100000001000000C1000000.cer",
    "diia-CA-05E19E2CD92EA2990100000001000000E1000000.cer",
    "diia-test-sign-7775603.cer",
    "diia-test-kep-7775604.cer",
    "diia-2023-tsp-05E19E2CD92EA29902000000010000004A010000.cer",
    "diia-ocsp-3ED5083160DBC59B0200000001000000202B0F00.cer",
  ];
  for (const name of names) {
    const certPath = join(certDir, name);
    if (!existsSync(certPath)) {
      continue;
    }
    const added = await call(adapter, "ADD_CERT", {
      certificates: [readFileSync(certPath).toString("base64")],
    });
    if (added.errorCode !== 0) {
      throw new VerifyFailedError(
        added.error ?? `ADD_CERT ${name} failed: ${String(added.errorCode)}`,
        added.errorCode,
      );
    }
  }
}

export type SignedAsic = {
  readonly bytes: Uint8Array;
  readonly payloadSha256: string;
};

/**
 * Build a STRUCT-verifiable ASiC-E around `payload` using the vendored
 * GOST PKCS#12. Used by package vectors and by doc-signing complete tests.
 * Does not rewrite UAPKI; it only packs ZIP + calls SIGN CAdES-BES.
 */
export async function createSignedAsicE(
  payload: AsicEntry,
  adapter: UapkiAdapter,
  options: { readonly password?: string; readonly p12Path?: string } = {},
): Promise<SignedAsic> {
  const p12Path = options.p12Path ?? GOST_P12;
  const password = options.password ?? GOST_PASSWORD;
  const digest = await call(adapter, "DIGEST", {
    hashAlgo: OID_GOST34311,
    bytes: uint8ToBase64(payload.bytes),
  });
  if (digest.errorCode !== 0) {
    throw new VerifyFailedError(
      digest.error ?? `DIGEST failed: ${String(digest.errorCode)}`,
      digest.errorCode,
    );
  }
  const digestB64 = stringField(asRecord(digest.result), "bytes");
  if (digestB64 === undefined) {
    throw new VerifyFailedError("DIGEST returned no bytes");
  }
  const digestUri = xmlDigestUriForHashOid(OID_GOST34311);
  const manifestXml = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<asic:ASiCManifest xmlns:asic="http://uri.etsi.org/02918/v1.2.1#" xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
  <asic:SigReference URI="META-INF/signature001.p7s" MimeType="application/x-pkcs7-signature"/>
  <asic:DataObjectReference URI="${payload.name}" MimeType="application/pdf">
    <ds:DigestMethod Algorithm="${digestUri}"/>
    <ds:DigestValue>${digestB64}</ds:DigestValue>
  </asic:DataObjectReference>
</asic:ASiCManifest>
`;
  const manifestBytes = new TextEncoder().encode(manifestXml);

  const keyPath = "/tmp/asic-sign-fixture.p12";
  await adapter.writeFile(keyPath, readFileSync(p12Path));
  const opened = await call(adapter, "OPEN", {
    provider: "PKCS12",
    storage: keyPath,
    password,
    mode: "RO",
  });
  if (opened.errorCode !== 0) {
    throw new VerifyFailedError(
      opened.error ?? `OPEN failed: ${String(opened.errorCode)}`,
      opened.errorCode,
    );
  }
  try {
    await addFixtureCerts(adapter);
    const keys = await call(adapter, "KEYS");
    const keyList = (keys.result?.keys ?? []) as Array<{ id: string }>;
    const firstKey = keyList[0];
    if (firstKey === undefined) {
      throw new VerifyFailedError("PKCS#12 contains no keys");
    }
    const selected = await call(adapter, "SELECT_KEY", { id: firstKey.id });
    const certB64 = stringField(asRecord(selected.result), "certificate");
    if (certB64 === undefined) {
      throw new VerifyFailedError("SELECT_KEY did not return a certificate");
    }
    const info = await call(adapter, "CERT_INFO", { bytes: certB64 });
    const spki = asRecord(asRecord(info.result).subjectPublicKeyInfo);
    const { signAlgo, digestAlgo } = resolveSignParams(
      stringField(spki, "algorithm") ?? "",
    );
    const signed = await call(adapter, "SIGN", {
      signParams: {
        signatureFormat: "CAdES-BES",
        signAlgo,
        digestAlgo,
        detachedData: true,
        includeCert: true,
        includeTime: false,
        includeContentTs: false,
      },
      // Fixture-only: vendored Diia test PKCS#12 is expired as of 2026-08.
      // UAPKI SIGN validates notAfter unless options.ignoreCertStatus is set
      // (CAdES-BES; JSON key is "options", not "signOptions").
      // Production VERIFY STRUCT does not use this option.
      options: { ignoreCertStatus: true },
      dataTbs: [{ id: "manifest", bytes: uint8ToBase64(manifestBytes) }],
    });
    if (signed.errorCode !== 0) {
      throw new VerifyFailedError(
        signed.error ?? `SIGN failed: ${String(signed.errorCode)}`,
        signed.errorCode,
      );
    }
    const signatures = signed.result?.signatures as
      Array<{ bytes?: string }> | undefined;
    const p7sB64 = signatures?.[0]?.bytes;
    if (typeof p7sB64 !== "string" || p7sB64.length === 0) {
      throw new VerifyFailedError("SIGN returned no signature data");
    }
    const p7s = base64ToUint8(p7sB64);
    const bytes = packAsicE([
      {
        name: "mimetype",
        bytes: new TextEncoder().encode("application/vnd.etsi.asic-e+zip"),
      },
      payload,
      { name: "META-INF/ASiCManifest001.xml", bytes: manifestBytes },
      { name: "META-INF/signature001.p7s", bytes: p7s },
    ]);
    return { bytes, payloadSha256: sha256Hex(payload.bytes) };
  } finally {
    await call(adapter, "CLOSE");
    await adapter.deleteFile(keyPath);
  }
}

export { unpackAsicE };
