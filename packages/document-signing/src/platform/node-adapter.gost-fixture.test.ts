import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createNodeAdapter } from "./node-adapter.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const GOST_P12 = join(packageRoot, "cpp/test/data/test-diia.p12");
const GOST_PASSWORD = "testpassword";
const OID_KUPYNA_SIGN_FAMILY = "1.2.804.2.1.1.1.1.3.6";

describe("node adapter GOST fixture OPEN (staging verify-kep-upgrade section A)", () => {
  const adapter = createNodeAdapter();

  beforeAll(async () => {
    await adapter.initialize({});
  });

  afterAll(async () => {
    await adapter.destroy();
  });

  it("opens the vendored GOST PKCS#12 and returns a non-Kupyna SPKI algorithm", async () => {
    const keyPath = "/tmp/gost-fixture.p12";
    await adapter.writeFile(keyPath, readFileSync(GOST_P12));
    const opened = await adapter.process(
      JSON.stringify({
        method: "OPEN",
        parameters: {
          provider: "PKCS12",
          storage: keyPath,
          password: GOST_PASSWORD,
          mode: "RO",
        },
      }),
    );
    expect(opened.errorCode).toBe(0);

    const keys = await adapter.process(JSON.stringify({ method: "KEYS" }));
    const keyList = (keys.result?.keys ?? []) as Array<{ id: string }>;
    expect(keyList.length).toBeGreaterThan(0);
    const firstKey = keyList[0];
    if (firstKey === undefined) {
      throw new Error("KEYS returned an empty list after OPEN");
    }

    const certDir = join(packageRoot, "cpp/test/data/certs");
    for (const name of [
      "diia-test-sign-7775603.cer",
      "diia-test-kep-7775604.cer",
    ]) {
      const certPath = join(certDir, name);
      try {
        await adapter.process(
          JSON.stringify({
            method: "ADD_CERT",
            parameters: {
              certificates: [readFileSync(certPath).toString("base64")],
            },
          }),
        );
      } catch {
        // fixture certs are optional if the tree omitted them
      }
    }

    const selected = await adapter.process(
      JSON.stringify({
        method: "SELECT_KEY",
        parameters: { id: firstKey.id },
      }),
    );
    const certB64 = selected.result?.certificate;
    expect(typeof certB64).toBe("string");
    if (typeof certB64 !== "string") {
      throw new Error("SELECT_KEY did not return a certificate");
    }

    const info = await adapter.process(
      JSON.stringify({
        method: "CERT_INFO",
        parameters: { bytes: certB64 },
      }),
    );
    expect(info.errorCode).toBe(0);
    const spki = info.result?.subjectPublicKeyInfo as
      { algorithm?: string } | undefined;
    const algorithm = spki?.algorithm ?? "";
    expect(algorithm.startsWith(OID_KUPYNA_SIGN_FAMILY)).toBe(false);

    await adapter.process(JSON.stringify({ method: "CLOSE" }));
  });
});
