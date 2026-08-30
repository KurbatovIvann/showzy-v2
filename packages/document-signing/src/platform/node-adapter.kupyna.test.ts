import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createNodeAdapter } from "./node-adapter.js";

const OID_KUPYNA256 = "1.2.804.2.1.1.1.1.2.2.1";
const OID_GOST = "1.2.804.2.1.1.1.1.2.1";

describe("node adapter kupyna smoke (staging vector)", () => {
  const adapter = createNodeAdapter();

  beforeAll(async () => {
    await adapter.initialize({});
  });

  afterAll(async () => {
    await adapter.destroy();
  });

  it("reports VERSION and distinct GOST vs Kupyna digests", async () => {
    const version = await adapter.process(
      JSON.stringify({ method: "VERSION" }),
    );
    expect(version.errorCode).toBe(0);
    expect(version.result).toBeTruthy();

    const gost = await adapter.process(
      JSON.stringify({
        method: "DIGEST",
        parameters: {
          hashAlgo: OID_GOST,
          bytes: Buffer.from("kupyna-smoke").toString("base64"),
        },
      }),
    );
    const kupyna = await adapter.process(
      JSON.stringify({
        method: "DIGEST",
        parameters: {
          hashAlgo: OID_KUPYNA256,
          bytes: Buffer.from("kupyna-smoke").toString("base64"),
        },
      }),
    );
    expect(gost.errorCode).toBe(0);
    expect(kupyna.errorCode).toBe(0);
    const gostBytes = gost.result?.bytes;
    const kupynaBytes = kupyna.result?.bytes;
    expect(typeof gostBytes).toBe("string");
    expect(typeof kupynaBytes).toBe("string");
    expect(gostBytes).not.toBe(kupynaBytes);
  });
});
