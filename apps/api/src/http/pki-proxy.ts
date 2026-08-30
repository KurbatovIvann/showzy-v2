/**
 * Unauthenticated `POST /pki/proxy` (SHO-255 / feature SHO-251). CORS/OCSP/TSA
 * proxy for on-device Nitro. Not a `defineAction`, not tenant-scoped, not a
 * share principal. Allowlist comes from `@showzy/document-signing` only.
 *
 * Do not log raw bodies or destination query strings (security-operations §4).
 */
import { createHmac } from "node:crypto";
import { promises as dns } from "node:dns";
import { BlockList, isIP } from "node:net";

import { IP_HMAC_ROTATION_MS, type RateLimitStore } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";
import {
  isPkiProxyAllowedHost,
  PKI_PROXY_PATH,
} from "@showzy/document-signing";
import type { Logger } from "pino";
import { z } from "zod";

import { normalizeIp } from "./client-ip.js";

export { PKI_PROXY_PATH };

/** Unauthenticated HTTP: same 30/min IP-HMAC default as public/share. */
export const PKI_PROXY_RATE_LIMIT = 30;
export const PKI_PROXY_RATE_WINDOW_SEC = 60;

const PKI_PROXY_TIMEOUT_MS = 10_000;
const PKI_PROXY_MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

const NOT_ALLOWED_MESSAGE = "Destination is not allowed.";
const INVALID_REQUEST_MESSAGE = "Invalid request.";
const RATE_LIMITED_MESSAGE = "Too many requests.";
const UPSTREAM_FAILED_MESSAGE = "Proxy request failed.";

const pkiProxyRequestSchema = z.object({
  url: z.string().min(1).max(2048),
  contentType: z.string().min(1).max(256).optional(),
  body: z.string().min(1).max(1_048_576).optional(),
});

export type PkiProxyLookup = (hostname: string) => Promise<readonly string[]>;

export type PkiProxyFetch = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export interface PkiProxyRuntime {
  readonly rateLimitStore: RateLimitStore;
  readonly ipHmacSecret: string;
  readonly lookup?: PkiProxyLookup;
  readonly fetchImpl?: PkiProxyFetch;
  readonly now?: () => number;
}

export interface PkiProxyResult {
  readonly status: 200 | 400 | 429 | 500;
  readonly body: Record<string, unknown>;
  readonly retryAfterSec?: number;
}

const blockedDestinations = createBlockedDestinationList();

function createBlockedDestinationList(): BlockList {
  const list = new BlockList();
  list.addSubnet("0.0.0.0", 8, "ipv4");
  list.addSubnet("10.0.0.0", 8, "ipv4");
  list.addSubnet("100.64.0.0", 10, "ipv4");
  list.addSubnet("127.0.0.0", 8, "ipv4");
  list.addSubnet("169.254.0.0", 16, "ipv4");
  list.addSubnet("172.16.0.0", 12, "ipv4");
  list.addSubnet("192.168.0.0", 16, "ipv4");
  list.addSubnet("198.18.0.0", 15, "ipv4");
  list.addSubnet("224.0.0.0", 4, "ipv4");
  list.addSubnet("240.0.0.0", 4, "ipv4");
  list.addAddress("::", "ipv6");
  list.addAddress("::1", "ipv6");
  list.addSubnet("fc00::", 7, "ipv6");
  list.addSubnet("fe80::", 10, "ipv6");
  list.addSubnet("ff00::", 8, "ipv6");
  return list;
}

export function isBlockedPkiDestinationAddress(address: string): boolean {
  const normalized = normalizeIp(address);
  if (isIP(normalized) === 0) {
    return true;
  }
  const ipType = normalized.includes(":") ? "ipv6" : "ipv4";
  try {
    return blockedDestinations.check(normalized, ipType);
  } catch {
    return true;
  }
}

function requireIpHmacSecret(secret: string): void {
  if (secret.length === 0) {
    throw new CoreInvariantError(
      "pki-proxy constructed with an empty ipHmacSecret — config wiring bug",
    );
  }
}

function pkiProxyRateLimitKey(
  clientIp: string,
  secret: string,
  now: () => number,
): string {
  const rotationWindow = Math.floor(now() / IP_HMAC_ROTATION_MS);
  const hmac = createHmac("sha256", secret)
    .update(`${String(rotationWindow)}:${clientIp}`)
    .digest("hex")
    .slice(0, 32);
  return `rl:pki.proxy:ipHmac:${hmac}`;
}

async function defaultLookup(hostname: string): Promise<readonly string[]> {
  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
}

function parseTargetUrl(raw: string): URL | null {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }
  if (parsed.username !== "" || parsed.password !== "") {
    return null;
  }
  if (!isDefaultPort(parsed)) {
    return null;
  }
  const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (host.length === 0 || isIP(host) !== 0) {
    return null;
  }
  if (!isPkiProxyAllowedHost(host)) {
    return null;
  }
  parsed.hostname = host;
  return parsed;
}

function isDefaultPort(url: URL): boolean {
  if (url.port === "") {
    return true;
  }
  if (url.protocol === "http:" && url.port === "80") {
    return true;
  }
  if (url.protocol === "https:" && url.port === "443") {
    return true;
  }
  return false;
}

function notAllowed(): PkiProxyResult {
  return { status: 400, body: { message: NOT_ALLOWED_MESSAGE } };
}

function invalidRequest(): PkiProxyResult {
  return { status: 400, body: { message: INVALID_REQUEST_MESSAGE } };
}

function logBlocked(
  logger: Logger,
  requestId: string,
  host: string | undefined,
  reason: string,
): void {
  logger.warn(
    {
      request_id: requestId,
      action: "pki.proxy",
      ...(host !== undefined ? { host } : {}),
      reason,
    },
    "pki proxy blocked",
  );
}

export async function executePkiProxy(options: {
  readonly request: Request;
  readonly requestId: string;
  readonly clientIp: string;
  readonly logger: Logger;
  readonly rateLimitStore: RateLimitStore;
  readonly ipHmacSecret: string;
  readonly lookup?: PkiProxyLookup;
  readonly fetchImpl?: PkiProxyFetch;
  readonly now?: () => number;
}): Promise<PkiProxyResult> {
  requireIpHmacSecret(options.ipHmacSecret);
  const now = options.now ?? Date.now;

  let decision;
  try {
    decision = await options.rateLimitStore.consume({
      key: pkiProxyRateLimitKey(options.clientIp, options.ipHmacSecret, now),
      limit: PKI_PROXY_RATE_LIMIT,
      windowSec: PKI_PROXY_RATE_WINDOW_SEC,
    });
  } catch {
    options.logger.error(
      { request_id: options.requestId, action: "pki.proxy", reason: "store" },
      "pki proxy rate-limit store failed",
    );
    return {
      status: 429,
      retryAfterSec: PKI_PROXY_RATE_WINDOW_SEC,
      body: { message: RATE_LIMITED_MESSAGE },
    };
  }
  if (!decision.allowed) {
    return {
      status: 429,
      retryAfterSec: decision.retryAfterSec,
      body: { message: RATE_LIMITED_MESSAGE },
    };
  }

  let raw: unknown;
  try {
    raw = await options.request.json();
  } catch {
    return invalidRequest();
  }
  const parsed = pkiProxyRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return invalidRequest();
  }

  let logHost: string | undefined;
  try {
    logHost = new URL(parsed.data.url).hostname
      .toLowerCase()
      .replace(/\.$/, "");
  } catch {
    logHost = undefined;
  }

  const target = parseTargetUrl(parsed.data.url);
  if (target === null) {
    logBlocked(options.logger, options.requestId, logHost, "allowlist");
    return notAllowed();
  }
  const host = target.hostname;

  const lookup = options.lookup ?? defaultLookup;
  let addresses: readonly string[];
  try {
    addresses = await lookup(host);
  } catch {
    logBlocked(options.logger, options.requestId, host, "dns");
    return notAllowed();
  }
  if (addresses.length === 0) {
    logBlocked(options.logger, options.requestId, host, "dns");
    return notAllowed();
  }
  for (const address of addresses) {
    if (isBlockedPkiDestinationAddress(address)) {
      logBlocked(options.logger, options.requestId, host, "dns_rebind");
      return notAllowed();
    }
  }

  const headers = new Headers();
  if (parsed.data.contentType !== undefined) {
    headers.set("Content-Type", parsed.data.contentType);
  }
  let body: Buffer | undefined;
  if (parsed.data.body !== undefined) {
    body = Buffer.from(parsed.data.body, "base64");
  }

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const init: RequestInit = {
    method: body === undefined ? "GET" : "POST",
    headers,
    redirect: "error",
    signal: AbortSignal.timeout(PKI_PROXY_TIMEOUT_MS),
  };
  if (body !== undefined) {
    init.body = body;
  }
  let response: Response;
  try {
    response = await fetchImpl(target.href, init);
  } catch {
    logBlocked(options.logger, options.requestId, host, "upstream");
    return { status: 400, body: { message: UPSTREAM_FAILED_MESSAGE } };
  }

  if (response.status >= 300 && response.status < 400) {
    logBlocked(options.logger, options.requestId, host, "redirect");
    return notAllowed();
  }

  let bytes: ArrayBuffer;
  try {
    bytes = await response.arrayBuffer();
  } catch {
    return { status: 400, body: { message: UPSTREAM_FAILED_MESSAGE } };
  }
  if (bytes.byteLength > PKI_PROXY_MAX_RESPONSE_BYTES) {
    logBlocked(options.logger, options.requestId, host, "too_large");
    return { status: 400, body: { message: UPSTREAM_FAILED_MESSAGE } };
  }

  const contentType = response.headers.get("content-type");
  const result: Record<string, unknown> = {
    status: response.status,
    bodyBase64: Buffer.from(bytes).toString("base64"),
  };
  if (contentType !== null && contentType !== "") {
    result.contentType = contentType;
  }
  return { status: 200, body: result };
}
