import { afterAll, describe, expect, it } from "vitest";

import { PKI_PROXY_PATH } from "../pki/proxy.js";
import {
  applyWasmCorsProxy,
  nativeAdapterHttpPlan,
  nodeAdapterHttpPlan,
  resolveAdapterHttpInit,
} from "./http-init.js";
import { createNodeAdapter } from "./node-adapter.js";

function initOffline(request: Record<string, unknown>): boolean {
  const parameters = request.parameters;
  if (typeof parameters !== "object" || parameters === null) {
    throw new Error("INIT request missing parameters");
  }
  if (!("offline" in parameters) || typeof parameters.offline !== "boolean") {
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
    expect(parsed).toEqual(
      expect.objectContaining({
        method: "INIT",
        parameters: expect.objectContaining({
          offline: true,
          certCache: { path: "/tmp/cache/uapki/certs/" },
          crlCache: { path: "/tmp/cache/uapki/crl/" },
        }),
      }),
    );
    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("native INIT JSON is not an object");
    }
    expect(initOffline(parsed)).toBe(true);
  });

  it("native INIT JSON is online only together with a proxy URL (handler will be registered)", () => {
    const { corsProxyUrl, initRequestJson } = nativeAdapterHttpPlan(
      "/tmp/cache/",
      { corsProxyUrl: PKI_PROXY_PATH },
    );
    expect(corsProxyUrl).toBe(PKI_PROXY_PATH);
    const parsed: unknown = JSON.parse(initRequestJson);
    if (typeof parsed !== "object" || parsed === null) {
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

  it("applies WASM set_cors_proxy_url only when a proxy is configured", () => {
    const calls: Array<{ name: string; args: unknown[] }> = [];
    const cwrap = (
      name: string,
      _returnType: string,
      _argTypes: string[],
    ): ((...args: unknown[]) => unknown) => {
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
