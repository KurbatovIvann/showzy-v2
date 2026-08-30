import { afterAll, describe, expect, it } from "vitest";

import { PKI_PROXY_PATH } from "../pki/proxy.js";
import {
  applyWasmCorsProxy,
  isRepeatInitSelfTestArtifact,
  nativeAdapterHttpPlan,
  nodeAdapterHttpPlan,
  resolveAdapterHttpInit,
  type UapkiCwrap,
  withSkipSelfTest,
} from "./http-init.js";
import { createNodeAdapter } from "./node-adapter.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function initOffline(request: Record<string, unknown>): boolean {
  const parameters = request.parameters;
  if (!isRecord(parameters)) {
    throw new Error("INIT request missing parameters");
  }
  if (typeof parameters.offline !== "boolean") {
    throw new Error("INIT request missing offline boolean");
  }
  return parameters.offline;
}

describe("adapter HTTP init contract (SHO-252)", () => {
  it("fails closed: INIT is offline and has no proxy when corsProxyUrl is omitted", () => {
    expect(resolveAdapterHttpInit({})).toEqual({
      corsProxyUrl: undefined,
      offline: true,
    });
    expect(resolveAdapterHttpInit({ corsProxyUrl: "" })).toEqual({
      corsProxyUrl: undefined,
      offline: true,
    });
    expect(resolveAdapterHttpInit({ corsProxyUrl: "   " })).toEqual({
      corsProxyUrl: undefined,
      offline: true,
    });
  });

  it("allows online INIT only when a proxy URL is configured", () => {
    expect(resolveAdapterHttpInit({ corsProxyUrl: PKI_PROXY_PATH })).toEqual({
      corsProxyUrl: PKI_PROXY_PATH,
      offline: false,
    });
    expect(
      resolveAdapterHttpInit({
        corsProxyUrl: `https://api.example.test${PKI_PROXY_PATH}`,
      }),
    ).toEqual({
      corsProxyUrl: `https://api.example.test${PKI_PROXY_PATH}`,
      offline: false,
    });
  });

  it("native INIT JSON is offline with no handler when no proxy is set", () => {
    const { corsProxyUrl, initRequestJson } = nativeAdapterHttpPlan(
      "/tmp/cache/",
      {},
    );
    expect(corsProxyUrl).toBeUndefined();
    const parsed: unknown = JSON.parse(initRequestJson);
    if (!isRecord(parsed)) {
      throw new Error("native INIT JSON is not an object");
    }
    expect(parsed.method).toBe("INIT");
    expect(initOffline(parsed)).toBe(true);
    if (!isRecord(parsed.parameters)) {
      throw new Error("native INIT JSON missing parameters");
    }
    expect(parsed.parameters.certCache).toEqual({
      path: "/tmp/cache/uapki/certs/",
    });
    expect(parsed.parameters.crlCache).toEqual({
      path: "/tmp/cache/uapki/crl/",
    });
  });

  it("native INIT JSON is online only together with a proxy URL (handler will be registered)", () => {
    const { corsProxyUrl, initRequestJson } = nativeAdapterHttpPlan(
      "/tmp/cache/",
      { corsProxyUrl: PKI_PROXY_PATH },
    );
    expect(corsProxyUrl).toBe(PKI_PROXY_PATH);
    const parsed: unknown = JSON.parse(initRequestJson);
    if (!isRecord(parsed)) {
      throw new Error("native INIT JSON is not an object");
    }
    expect(initOffline(parsed)).toBe(false);
  });

  it("Node INIT is offline when no proxy is configured", () => {
    const { corsProxyUrl, initRequest } = nodeAdapterHttpPlan({});
    expect(corsProxyUrl).toBeUndefined();
    expect(initOffline(initRequest)).toBe(true);
  });

  it("Node INIT is online when corsProxyUrl is set", () => {
    const { corsProxyUrl, initRequest } = nodeAdapterHttpPlan({
      corsProxyUrl: PKI_PROXY_PATH,
    });
    expect(corsProxyUrl).toBe(PKI_PROXY_PATH);
    expect(initOffline(initRequest)).toBe(false);
  });

  it("detects the repeat-init DRBG self-test artifact and nothing else", () => {
    const artifact = {
      errorCode: 33,
      error: "SELF_TEST_FAIL",
      method: "INIT",
      result: { selfTestStatus: 0x2 },
    };
    expect(isRepeatInitSelfTestArtifact(artifact)).toBe(true);

    // Real crypto failures (extra bits set) must never be bypassed.
    expect(
      isRepeatInitSelfTestArtifact({
        ...artifact,
        result: { selfTestStatus: 0x2 | 0x20 },
      }),
    ).toBe(false);
    expect(
      isRepeatInitSelfTestArtifact({
        ...artifact,
        result: { selfTestStatus: 0x1 },
      }),
    ).toBe(false);
    // Old binaries without the selfTestStatus patch: fail closed.
    expect(isRepeatInitSelfTestArtifact({ ...artifact, result: {} })).toBe(
      false,
    );
    // Other errors and successes are untouched.
    expect(
      isRepeatInitSelfTestArtifact({
        errorCode: 1,
        error: "GENERAL_ERROR",
        result: { selfTestStatus: 0x2 },
      }),
    ).toBe(false);
    expect(
      isRepeatInitSelfTestArtifact({ errorCode: 0, result: {} }),
    ).toBe(false);
  });

  it("withSkipSelfTest adds the flag and keeps the rest of the INIT request", () => {
    const { initRequestJson } = nativeAdapterHttpPlan("/tmp/cache/", {});
    const retryJson = withSkipSelfTest(initRequestJson);
    const parsed: unknown = JSON.parse(retryJson);
    if (!isRecord(parsed) || !isRecord(parsed.parameters)) {
      throw new Error("retry INIT JSON missing parameters");
    }
    expect(parsed.method).toBe("INIT");
    expect(parsed.parameters.skipSelfTest).toBe(true);
    expect(parsed.parameters.certCache).toEqual({
      path: "/tmp/cache/uapki/certs/",
    });
    expect(initOffline(parsed)).toBe(true);
  });

  it("applies WASM set_cors_proxy_url only when a proxy is configured", () => {
    const calls: Array<{ name: string; args: unknown[] }> = [];
    const cwrap: UapkiCwrap = (name) => {
      return (...args: unknown[]) => {
        calls.push({ name, args });
        return undefined;
      };
    };

    applyWasmCorsProxy(cwrap, undefined);
    expect(calls).toEqual([]);

    applyWasmCorsProxy(cwrap, PKI_PROXY_PATH);
    expect(calls).toEqual([
      { name: "set_cors_proxy_url", args: [PKI_PROXY_PATH] },
    ]);
  });
});

describe("NodeAdapter initialize honors the HTTP plan without network", () => {
  const offlineAdapter = createNodeAdapter();
  const proxiedAdapter = createNodeAdapter();

  afterAll(async () => {
    await offlineAdapter.destroy();
    await proxiedAdapter.destroy();
  });

  it("initializes offline with no proxy (verify-only default)", async () => {
    await offlineAdapter.initialize({});
    const version = await offlineAdapter.process(
      JSON.stringify({ method: "VERSION" }),
    );
    expect(version.errorCode).toBe(0);
  });

  it("initializes with corsProxyUrl without fetching the target network", async () => {
    await proxiedAdapter.initialize({ corsProxyUrl: PKI_PROXY_PATH });
    const version = await proxiedAdapter.process(
      JSON.stringify({ method: "VERSION" }),
    );
    expect(version.errorCode).toBe(0);
  });
});
