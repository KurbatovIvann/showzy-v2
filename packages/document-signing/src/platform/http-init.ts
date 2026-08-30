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

/** uapkic.h SELF_TEST_DRBG_FAIL bit. */
const SELF_TEST_DRBG_FAIL = 0x2;

/**
 * True when an INIT failure is the repeat-init artifact rather than a real
 * crypto self-test failure.
 *
 * uapkic runs its power-up self-test on every INIT, but `drbg_self_test()`
 * refuses to run (`RET_SELF_TEST_NOT_ALLOWED`) once the process-wide DRBG is
 * initialized — which the first INIT does permanently. So any re-INIT in the
 * same OS process (retry after a failed signing attempt, adapter re-creation
 * after a JS reload) reports SELF_TEST_FAIL with a status of exactly
 * SELF_TEST_DRBG_FAIL. That is safe to bypass with `skipSelfTest`: the full
 * self-test already passed on the first INIT of this process, and a real
 * DRBG (HMAC-SHA-512) breakage would also set the SHA2/HMAC bits.
 */
export function isRepeatInitSelfTestArtifact(response: {
  errorCode: number;
  error?: string;
  result?: Record<string, unknown>;
}): boolean {
  return (
    response.errorCode !== 0 &&
    (response.error ?? "").includes("SELF_TEST_FAIL") &&
    response.result?.["selfTestStatus"] === SELF_TEST_DRBG_FAIL
  );
}

/** The INIT request with the self-test disabled (repeat-init retry). */
export function withSkipSelfTest(initRequestJson: string): string {
  const request = JSON.parse(initRequestJson) as {
    parameters?: Record<string, unknown>;
  };
  request.parameters = { ...request.parameters, skipSelfTest: true };
  return JSON.stringify(request);
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
