import { Writable } from "node:stream";

import { ActionRegistry, createInMemoryRateLimitStore } from "@showzy/core";
import { PKI_PROXY_PATH } from "@showzy/document-signing";
import { pino, type Logger } from "pino";
import { describe, expect, it } from "vitest";

import { createApp } from "./app.js";
import {
  isBlockedPkiDestinationAddress,
  PKI_PROXY_RATE_LIMIT,
  type PkiProxyFetch,
  type PkiProxyLookup,
} from "./pki-proxy.js";

const HMAC_SECRET = "test-pki-proxy-ip-hmac-secret!!";
const ALLOWED_OCSP = "http://ca.monobank.ua/services/ocsp/";
const PUBLIC_IP = "203.0.113.10";

function capturingLogger(): {
  readonly logger: Logger;
  readonly lines: Record<string, unknown>[];
} {
  const lines: Record<string, unknown>[] = [];
  const logger: Logger = pino(
    { level: "info" },
    new Writable({
      write(chunk, _encoding, callback) {
        lines.push(JSON.parse(String(chunk)) as Record<string, unknown>);
        callback();
      },
    }),
  );
  return { logger, lines };
}

function pkiApp(overrides?: {
  readonly lookup?: PkiProxyLookup;
  readonly fetchImpl?: PkiProxyFetch;
  readonly logger?: Logger;
  readonly rateLimitStore?: ReturnType<typeof createInMemoryRateLimitStore>;
}) {
  const { logger } = capturingLogger();
  return createApp({
    auth: {
      handler: () => Promise.resolve(new Response(null, { status: 404 })),
      api: { getSession: () => Promise.resolve(null) },
    },
    registry: new ActionRegistry(),
    contractModules: {},
    pipeline: {
      db: {
        transaction: () => {
          throw new Error("unit tests do not open transactions");
        },
      },
      logger: overrides?.logger ?? logger,
    },
    trustedProxies: [],
    getPeerAddress: () => PUBLIC_IP,
    pkiProxy: {
      rateLimitStore:
        overrides?.rateLimitStore ?? createInMemoryRateLimitStore(),
      ipHmacSecret: HMAC_SECRET,
      lookup: overrides?.lookup ?? (() => Promise.resolve([PUBLIC_IP])),
      now: () => 1_700_000_000_000,
      ...(overrides?.fetchImpl !== undefined
        ? { fetchImpl: overrides.fetchImpl }
        : {}),
    },
  });
}

async function postProxy(
  app: ReturnType<typeof createApp>,
  body: unknown,
): Promise<Response> {
  return await app.request(PKI_PROXY_PATH, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("isBlockedPkiDestinationAddress", () => {
  it("blocks loopback, private, link-local, CGNAT, and metadata", () => {
    expect(isBlockedPkiDestinationAddress("127.0.0.1")).toBe(true);
    expect(isBlockedPkiDestinationAddress("10.0.0.1")).toBe(true);
    expect(isBlockedPkiDestinationAddress("192.168.1.1")).toBe(true);
    expect(isBlockedPkiDestinationAddress("172.16.0.1")).toBe(true);
    expect(isBlockedPkiDestinationAddress("169.254.1.1")).toBe(true);
    expect(isBlockedPkiDestinationAddress("169.254.169.254")).toBe(true);
    expect(isBlockedPkiDestinationAddress("100.64.0.1")).toBe(true);
    expect(isBlockedPkiDestinationAddress("::1")).toBe(true);
    expect(isBlockedPkiDestinationAddress("fe80::1")).toBe(true);
    expect(isBlockedPkiDestinationAddress("fc00::1")).toBe(true);
    expect(isBlockedPkiDestinationAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isBlockedPkiDestinationAddress("::ffff:169.254.169.254")).toBe(true);
  });

  it("allows documentation and public unicast", () => {
    expect(isBlockedPkiDestinationAddress(PUBLIC_IP)).toBe(false);
    expect(isBlockedPkiDestinationAddress("8.8.8.8")).toBe(false);
  });
});

describe("POST /pki/proxy", () => {
  it("is unauthenticated HTTP (never 401) and uses the copied package path", () => {
    expect(PKI_PROXY_PATH).toBe("/pki/proxy");
  });

  it("rejects a host outside the copied-package allowlist", async () => {
    const fetches: string[] = [];
    const app = pkiApp({
      lookup: () =>
        Promise.reject(new Error("lookup must not run for a blocked host")),
      fetchImpl: (url) => {
        fetches.push(url);
        return Promise.resolve(new Response("nope"));
      },
    });
    const response = await postProxy(app, { url: "https://example.com/ocsp" });
    expect(response.status).toBe(400);
    expect(response.status).not.toBe(401);
    expect(await response.json()).toEqual({
      message: "Destination is not allowed.",
    });
    expect(fetches).toEqual([]);
  });

  it("rejects v1-style .ua suffix hosts that are not in the package allowlist", async () => {
    const app = pkiApp({
      fetchImpl: () => Promise.resolve(new Response("nope")),
    });
    const response = await postProxy(app, { url: "http://evil.ua/ocsp" });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      message: "Destination is not allowed.",
    });
  });

  it("rejects userinfo, IP literals, and non-default ports", async () => {
    const app = pkiApp({
      fetchImpl: () => Promise.resolve(new Response("nope")),
    });
    const userinfo = await postProxy(app, {
      url: "http://user:pass@ca.monobank.ua/services/ocsp/",
    });
    expect(userinfo.status).toBe(400);
    const ipLiteral = await postProxy(app, { url: "http://127.0.0.1/ocsp" });
    expect(ipLiteral.status).toBe(400);
    const port = await postProxy(app, {
      url: "http://ca.monobank.ua:8080/services/ocsp/",
    });
    expect(port.status).toBe(400);
  });

  it("does not follow redirects", async () => {
    const fetches: string[] = [];
    const app = pkiApp({
      fetchImpl: (url) => {
        fetches.push(url);
        return Promise.resolve(
          new Response(null, {
            status: 302,
            headers: { Location: "http://127.0.0.1/secret" },
          }),
        );
      },
    });
    const response = await postProxy(app, { url: ALLOWED_OCSP });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      message: "Destination is not allowed.",
    });
    expect(fetches).toEqual([ALLOWED_OCSP]);
  });

  it("fails when fetch is invoked with redirect:error and throws", async () => {
    const fetches: RequestInit[] = [];
    const app = pkiApp({
      fetchImpl: (_url, init) => {
        fetches.push(init ?? {});
        return Promise.reject(
          new TypeError("uri requested responds with a redirect"),
        );
      },
    });
    const response = await postProxy(app, { url: ALLOWED_OCSP });
    expect(response.status).toBe(400);
    expect(fetches[0]?.redirect).toBe("error");
  });

  it.each([
    ["loopback", "127.0.0.1"],
    ["private RFC1918", "10.1.2.3"],
    ["link-local", "169.254.12.34"],
    ["metadata", "169.254.169.254"],
    ["IPv6 loopback", "::1"],
    ["IPv6 link-local", "fe80::1"],
    ["IPv6 unique-local", "fc00::1"],
    ["IPv4-mapped loopback", "::ffff:127.0.0.1"],
  ])("rejects public-host DNS rebinding to %s", async (_label, address) => {
    const fetches: string[] = [];
    const lookedUp: string[] = [];
    const app = pkiApp({
      lookup: (hostname) => {
        lookedUp.push(hostname);
        return Promise.resolve([address]);
      },
      fetchImpl: (url) => {
        fetches.push(url);
        return Promise.resolve(new Response("nope"));
      },
    });
    const response = await postProxy(app, { url: ALLOWED_OCSP });
    expect(response.status).toBe(400);
    expect(lookedUp).toEqual(["ca.monobank.ua"]);
    expect(fetches).toEqual([]);
  });

  it("rejects a mixed public+private DNS answer (any blocked address fails)", async () => {
    const fetches: string[] = [];
    const app = pkiApp({
      lookup: () => Promise.resolve([PUBLIC_IP, "127.0.0.1"]),
      fetchImpl: (url) => {
        fetches.push(url);
        return Promise.resolve(new Response("nope"));
      },
    });
    const response = await postProxy(app, { url: ALLOWED_OCSP });
    expect(response.status).toBe(400);
    expect(fetches).toEqual([]);
  });

  it("happy path to an allowlisted host is mocked at the network boundary", async () => {
    const fetches: { url: string; init?: RequestInit }[] = [];
    const payload = Buffer.from("ocsp-ok");
    const app = pkiApp({
      lookup: (hostname) => {
        expect(hostname).toBe("ca.monobank.ua");
        return Promise.resolve([PUBLIC_IP]);
      },
      fetchImpl: (url, init) => {
        fetches.push({
          url,
          ...(init !== undefined ? { init } : {}),
        });
        return Promise.resolve(
          new Response(payload, {
            status: 200,
            headers: { "content-type": "application/ocsp-response" },
          }),
        );
      },
    });
    const response = await postProxy(app, {
      url: ALLOWED_OCSP,
      contentType: "application/ocsp-request",
      body: Buffer.from("req").toString("base64"),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 200,
      contentType: "application/ocsp-response",
      bodyBase64: payload.toString("base64"),
    });
    expect(fetches).toHaveLength(1);
    expect(fetches[0]?.url).toBe(ALLOWED_OCSP);
    expect(fetches[0]?.init?.method).toBe("POST");
    expect(fetches[0]?.init?.redirect).toBe("error");
  });

  it("rate-limits unauthenticated POSTs per IP-HMAC (fail-closed on store errors)", async () => {
    const store = createInMemoryRateLimitStore({
      now: () => 1_700_000_000_000,
    });
    const app = pkiApp({
      rateLimitStore: store,
      fetchImpl: () =>
        Promise.resolve(
          new Response("ok", {
            status: 200,
            headers: { "content-type": "text/plain" },
          }),
        ),
    });
    for (let i = 0; i < PKI_PROXY_RATE_LIMIT; i += 1) {
      const ok = await postProxy(app, { url: ALLOWED_OCSP });
      expect(ok.status).toBe(200);
    }
    const limited = await postProxy(app, { url: ALLOWED_OCSP });
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toEqual(expect.any(String));
    expect(await limited.json()).toEqual({ message: "Too many requests." });

    const failing = pkiApp({
      rateLimitStore: {
        consume: () => Promise.reject(new Error("redis down")),
      },
      fetchImpl: () => Promise.resolve(new Response("ok")),
    });
    const closed = await postProxy(failing, { url: ALLOWED_OCSP });
    expect(closed.status).toBe(429);
  });

  it("does not log raw bodies or destination query strings", async () => {
    const { logger, lines } = capturingLogger();
    const secretBody = Buffer.from("pkcs7-secret-bytes").toString("base64");
    const app = pkiApp({
      logger,
      fetchImpl: () =>
        Promise.resolve(
          new Response("ok", {
            status: 200,
            headers: { "content-type": "text/plain" },
          }),
        ),
    });
    const response = await postProxy(app, {
      url: `${ALLOWED_OCSP}?token=super-secret-query`,
      body: secretBody,
    });
    expect(response.status).toBe(200);
    const dumped = JSON.stringify(lines);
    expect(dumped).not.toContain("super-secret-query");
    expect(dumped).not.toContain(secretBody);
    expect(dumped).not.toContain("pkcs7-secret-bytes");
    expect(dumped).not.toContain("token=");

    const blocked = await postProxy(app, {
      url: "https://example.com/ocsp?token=super-secret-query",
      body: secretBody,
    });
    expect(blocked.status).toBe(400);
    const afterBlock = JSON.stringify(lines);
    expect(afterBlock).not.toContain("super-secret-query");
    expect(afterBlock).not.toContain(secretBody);
    expect(afterBlock).toContain("example.com");
    expect(afterBlock).not.toContain("?token=");
  });
});
