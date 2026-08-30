/**
 * v2 PKI CORS/SSRF proxy path (SHO-255 owns the HTTP route).
 * Adapters and callers must use this path, not the v1 API CORS proxy.
 */
export const PKI_PROXY_PATH = "/pki/proxy";

export interface ProxyResult {
  status: number;
  contentType?: string;
  bodyBase64?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isProxyResult(value: unknown): value is ProxyResult {
  if (!isRecord(value)) {
    return false;
  }
  if (typeof value.status !== "number") {
    return false;
  }
  if (
    value.contentType !== undefined &&
    typeof value.contentType !== "string"
  ) {
    return false;
  }
  if (value.bodyBase64 !== undefined && typeof value.bodyBase64 !== "string") {
    return false;
  }
  return true;
}

/**
 * Accept the v2 raw proxy body `{ status, bodyBase64 }` and the v1
 * interceptor wrap `{ data: { status, bodyBase64 } }` if it still appears.
 */
export function unwrapProxyResponse(raw: unknown): ProxyResult {
  if (!isRecord(raw)) {
    throw new Error("PKI proxy response is not an object");
  }
  if (isProxyResult(raw.data)) {
    return raw.data;
  }
  if (isProxyResult(raw)) {
    return raw;
  }
  throw new Error("PKI proxy response missing status");
}

/**
 * Fetch a URL through the v2 PKI proxy (`POST /pki/proxy`). Used on web
 * where direct cross-origin requests are blocked. On native, corsProxyUrl
 * can be omitted and fetchDirect is used instead.
 */
export async function proxyFetch(
  corsProxyUrl: string,
  targetUrl: string,
  options?: { contentType?: string; body?: string },
): Promise<ProxyResult> {
  const body: { url: string; contentType?: string; body?: string } = {
    url: targetUrl,
  };
  if (options?.contentType !== undefined) {
    body.contentType = options.contentType;
  }
  if (options?.body !== undefined) {
    body.body = options.body;
  }

  const resp = await fetch(corsProxyUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) throw new Error(`Proxy HTTP ${String(resp.status)}`);
  const raw: unknown = await resp.json();
  return unwrapProxyResponse(raw);
}
