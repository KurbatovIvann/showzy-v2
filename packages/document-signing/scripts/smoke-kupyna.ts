import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createNodeAdapter } from "../src/platform/node-adapter.ts";

const OID_KUPYNA256 = "1.2.804.2.1.1.1.1.2.2.1";
const OID_GOST = "1.2.804.2.1.1.1.1.2.1";
const scriptDir = dirname(fileURLToPath(import.meta.url));

async function digest(
  adapter: ReturnType<typeof createNodeAdapter>,
  oid: string,
) {
  const res = await adapter.process(
    JSON.stringify({
      method: "DIGEST",
      parameters: {
        hashAlgo: oid,
        bytes: Buffer.from("kupyna-smoke").toString("base64"),
      },
    }),
  );
  if (res.errorCode !== 0) {
    throw new Error(`${oid} DIGEST failed: ${res.error ?? res.errorCode}`);
  }
  const bytes = res.result?.bytes;
  return typeof bytes === "string" ? bytes : undefined;
}

async function main() {
  const adapter = createNodeAdapter(resolve(scriptDir, "../wasm/dist"));
  await adapter.initialize({});
  const version = await adapter.process(JSON.stringify({ method: "VERSION" }));
  console.log("VERSION", version.result);
  const gost = await digest(adapter, OID_GOST);
  const kupyna = await digest(adapter, OID_KUPYNA256);
  if (!gost || !kupyna || gost === kupyna) {
    throw new Error("GOST and Kupyna digests must both succeed and differ");
  }
  await adapter.destroy();
  console.log("smoke-kupyna OK");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
