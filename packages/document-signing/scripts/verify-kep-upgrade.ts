/**
 * Task 10 verification: GOST fixture OPEN, Kupyna DIGEST, CZO ASiC-E VERIFY.
 * Downloads CZO samples to os.tmpdir(); does not write them into the repo.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createNodeAdapter } from "../src/platform/node-adapter.ts";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const WASM_DIR = resolve(scriptDir, "../wasm/dist");
const GOST_P12 = resolve(scriptDir, "../cpp/test/data/test-diia.p12");
const GOST_PASSWORD = "testpassword";

const ASICE_URL =
  "https://czo.gov.ua/download/test_sign/ASiC-E/DSTU-7564/CAdES-BES/test.txt.asice";
const CA_BUNDLE_URL =
  "https://czo.gov.ua/download/certificates/CACertificates.p7b";

const OID_KUPYNA256 = "1.2.804.2.1.1.1.1.2.2.1";
const OID_GOST = "1.2.804.2.1.1.1.1.2.1";
const OID_KUPYNA_SIGN_FAMILY = "1.2.804.2.1.1.1.1.3.6";

type Adapter = Awaited<ReturnType<typeof createNodeAdapter>>;

async function call(
  adapter: Adapter,
  method: string,
  parameters?: Record<string, unknown>,
) {
  return adapter.process(JSON.stringify({ method, parameters }));
}

async function download(url: string, dest: string): Promise<void> {
  if (existsSync(dest) && readFileSync(dest).length > 0) return;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`GET ${url} -> ${res.status}`);
  }
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

function extractAsice(asicePath: string, destDir: string): void {
  mkdirSync(destDir, { recursive: true });
  execFileSync("tar", ["-xf", asicePath, "-C", destDir]);
}

async function digest(adapter: Adapter, oid: string): Promise<string> {
  const res = await call(adapter, "DIGEST", {
    hashAlgo: oid,
    bytes: Buffer.from("kupyna-smoke").toString("base64"),
  });
  if (res.errorCode !== 0) {
    throw new Error(`${oid} DIGEST failed: ${res.error ?? res.errorCode}`);
  }
  const bytes = (res.result as { bytes?: string }).bytes;
  if (!bytes) throw new Error(`${oid} DIGEST returned no bytes`);
  return bytes;
}

async function sectionA(adapter: Adapter): Promise<void> {
  if (!existsSync(GOST_P12)) {
    throw new Error(`Missing GOST fixture: ${GOST_P12}`);
  }

  const keyPath = "/tmp/gost-fixture.p12";
  await adapter.writeFile(keyPath, readFileSync(GOST_P12));
  const opened = await call(adapter, "OPEN", {
    provider: "PKCS12",
    storage: keyPath,
    password: GOST_PASSWORD,
    mode: "RO",
  });
  if (opened.errorCode !== 0) {
    throw new Error(`OPEN failed: ${opened.error ?? opened.errorCode}`);
  }

  const keys = await call(adapter, "KEYS");
  const keyList = (keys.result as { keys?: Array<{ id: string }> })?.keys ?? [];
  if (keyList.length === 0) {
    throw new Error("OPEN succeeded but KEYS returned none");
  }

  const certDir = resolve(scriptDir, "../cpp/test/data/certs");
  for (const name of [
    "diia-test-sign-7775603.cer",
    "diia-test-kep-7775604.cer",
  ]) {
    const certPath = join(certDir, name);
    if (!existsSync(certPath)) continue;
    await call(adapter, "ADD_CERT", {
      certificates: [readFileSync(certPath).toString("base64")],
    });
  }

  const selected = await call(adapter, "SELECT_KEY", { id: keyList[0]!.id });
  const certB64 = (selected.result as { certificate?: string })?.certificate;
  if (!certB64) {
    throw new Error("SELECT_KEY did not return a certificate after ADD_CERT");
  }
  const info = await call(adapter, "CERT_INFO", { bytes: certB64 });
  if (info.errorCode !== 0) {
    throw new Error(`CERT_INFO failed: ${info.error ?? info.errorCode}`);
  }
  const spki = (
    info.result as { subjectPublicKeyInfo?: { algorithm?: string } }
  )?.subjectPublicKeyInfo;
  const algorithm = spki?.algorithm ?? "";
  console.log("A OPEN+KEYS+CERT_INFO", {
    keyId: keyList[0]!.id,
    algorithm,
  });
  if (algorithm.startsWith(OID_KUPYNA_SIGN_FAMILY)) {
    throw new Error("Expected GOST fixture, got Kupyna SPKI algorithm");
  }
  await call(adapter, "CLOSE");
}

async function sectionBC(adapter: Adapter): Promise<void> {
  const cacheDir = join(tmpdir(), "czo-kep-verify");
  mkdirSync(cacheDir, { recursive: true });
  const asicePath = join(cacheDir, "test.txt.asice");
  const caPath = join(cacheDir, "CACertificates.p7b");
  const extractDir = join(cacheDir, "asice");

  await download(ASICE_URL, asicePath);
  await download(CA_BUNDLE_URL, caPath);
  extractAsice(asicePath, extractDir);

  const manifest = readFileSync(
    join(extractDir, "META-INF/ASiCManifest001.xml"),
  );
  const p7s = readFileSync(join(extractDir, "META-INF/signature001.p7s"));
  if (!manifest.toString("utf8").includes("dstu7564-256")) {
    throw new Error("ASiC manifest is not Kupyna DigestMethod");
  }

  const version = await call(adapter, "VERSION");
  console.log("B VERSION", version.result);

  const gost = await digest(adapter, OID_GOST);
  const kupyna = await digest(adapter, OID_KUPYNA256);
  if (gost === kupyna) {
    throw new Error("GOST and Kupyna digests must differ");
  }
  console.log("B DIGEST OK");

  const add = await call(adapter, "ADD_CERT", {
    bundle: readFileSync(caPath).toString("base64"),
  });
  const added = (add.result as { added?: unknown[] })?.added;
  console.log("C ADD_CERT", {
    errorCode: add.errorCode,
    error: add.error,
    addedCount: Array.isArray(added) ? added.length : 0,
  });

  for (const validationType of ["STRUCT", "CHAIN"] as const) {
    const verify = await call(adapter, "VERIFY", {
      signature: {
        bytes: p7s.toString("base64"),
        content: manifest.toString("base64"),
      },
      validationType,
    });
    const infos = (
      verify.result as { signatureInfos?: Array<Record<string, unknown>> }
    )?.signatureInfos;
    const first = infos?.[0];
    console.log(`C VERIFY ${validationType}`, {
      errorCode: verify.errorCode,
      error: verify.error,
      statusSignature: first?.statusSignature,
      statusMessageDigest: first?.statusMessageDigest,
      signFormat: first?.signFormat,
    });
    if (verify.errorCode !== 0) {
      throw new Error(
        `VERIFY ${validationType} failed: ${verify.error ?? verify.errorCode}`,
      );
    }
    if (first?.statusSignature !== "VALID") {
      throw new Error(
        `VERIFY ${validationType} statusSignature=${String(first?.statusSignature)}`,
      );
    }
  }
}

async function main() {
  const adapter = createNodeAdapter(WASM_DIR);
  await adapter.initialize({});
  try {
    await sectionA(adapter);
    await sectionBC(adapter);
  } finally {
    await adapter.destroy();
  }
  console.log("verify-kep-upgrade OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
