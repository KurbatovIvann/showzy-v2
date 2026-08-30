import type { AdapterInitOptions } from "./adapter.js";

/**
 * Native Nitro / Node WASM HTTP contract (SHO-252 adapter re-audit).
 *
 * Online UAPKI INIT is allowed only when a v2 PKI proxy URL is configured.
 * Without a proxy, INIT is offline (fail closed): native has no HTTP handler,
 * and Node must not let the Emscripten helper fetch attacker-controlled
 * OCSP/TSP/CRL URLs directly (SSRF). Direct WASM fetches with an empty
 * proxy remain a web-worker concern; do not copy that onto Node.
 */
export interface AdapterHttpInit {
  corsProxyUrl: string | undefined;
  offline: boolean;
}

export type UapkiCwrap = (
  name: string,
  returnType: string,
  argTypes: string[],
) => (...args: unknown[]) => unknown;

export function resolveAdapterHttpInit(
  options: AdapterInitOptions,
): AdapterHttpInit {
  const trimmed = options.corsProxyUrl?.trim();
  const corsProxyUrl =
    trimmed !== undefined && trimmed.length > 0 ? trimmed : undefined;
  return {
    corsProxyUrl,
    offline: corsProxyUrl === undefined,
  };
}

export function uapkiInitRequest(
  certCachePath: string,
  crlCachePath: string,
  offline: boolean,
): Record<string, unknown> {
  return {
    method: "INIT",
    parameters: {
      cmProviders: {
        dir: "",
        allowedProviders: [{ lib: "cm-pkcs12" }],
      },
      certCache: { path: certCachePath },
      crlCache: { path: crlCachePath },
      offline,
    },
  };
}

export function nativeAdapterHttpPlan(
  tempDir: string,
  options: AdapterInitOptions,
): { corsProxyUrl: string | undefined; initRequestJson: string } {
  const { corsProxyUrl, offline } = resolveAdapterHttpInit(options);
  return {
    corsProxyUrl,
    initRequestJson: JSON.stringify(
      uapkiInitRequest(
        `${tempDir}uapki/certs/`,
        `${tempDir}uapki/crl/`,
        offline,
      ),
    ),
  };
}

export function nodeAdapterHttpPlan(options: AdapterInitOptions): {
  corsProxyUrl: string | undefined;
  initRequest: Record<string, unknown>;
} {
  const { corsProxyUrl, offline } = resolveAdapterHttpInit(options);
  return {
    corsProxyUrl,
    initRequest: uapkiInitRequest("/certs", "/crl", offline),
  };
}

/**
 * Mirror the web worker: `set_cors_proxy_url` only when a proxy is set.
 * Callers must not INIT online unless this ran with a URL.
 */
export function applyWasmCorsProxy(
  cwrap: UapkiCwrap,
  corsProxyUrl: string | undefined,
): void {
  if (corsProxyUrl === undefined) {
    return;
  }
  const setCorsProxyUrl = cwrap("set_cors_proxy_url", "void", ["string"]);
  setCorsProxyUrl(corsProxyUrl);
}
