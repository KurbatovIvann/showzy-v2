import { describe, expect, it } from "vitest";

import {
  createTrustedProxyMatcher,
  normalizeIp,
  resolveClientIp,
} from "./client-ip.js";

const PEER = "198.51.100.10";
const INGRESS = "10.0.0.1";
const CLIENT = "203.0.113.50";
const SPOOF = "1.2.3.4";

function resolve(input: {
  readonly peerAddress: string;
  readonly forwardedFor: string | undefined;
  readonly trustedProxies: readonly string[];
}): string {
  return resolveClientIp({
    peerAddress: input.peerAddress,
    forwardedFor: input.forwardedFor,
    isTrusted: createTrustedProxyMatcher(input.trustedProxies),
  });
}

describe("resolveClientIp (security-operations §2)", () => {
  it("ignores a spoofed X-Forwarded-For when no proxy is trusted", () => {
    expect(
      resolve({
        peerAddress: PEER,
        forwardedFor: SPOOF,
        trustedProxies: [],
      }),
    ).toBe(PEER);
  });

  it("ignores a spoofed X-Forwarded-For when the peer is not a trusted proxy", () => {
    expect(
      resolve({
        peerAddress: PEER,
        forwardedFor: SPOOF,
        trustedProxies: [INGRESS],
      }),
    ).toBe(PEER);
  });

  it("takes the client hop when the immediate peer is a trusted ingress", () => {
    expect(
      resolve({
        peerAddress: INGRESS,
        forwardedFor: CLIENT,
        trustedProxies: [INGRESS],
      }),
    ).toBe(CLIENT);
  });

  it("skips a client-spoofed leftmost hop; the ingress-appended address wins", () => {
    expect(
      resolve({
        peerAddress: INGRESS,
        forwardedFor: `${SPOOF}, ${CLIENT}`,
        trustedProxies: [INGRESS],
      }),
    ).toBe(CLIENT);
  });

  it("matches trusted proxies by CIDR", () => {
    expect(
      resolve({
        peerAddress: "10.8.1.4",
        forwardedFor: CLIENT,
        trustedProxies: ["10.0.0.0/8"],
      }),
    ).toBe(CLIENT);
  });

  it("falls back to the peer when a trusted proxy sent no forwarded header", () => {
    expect(
      resolve({
        peerAddress: INGRESS,
        forwardedFor: undefined,
        trustedProxies: [INGRESS],
      }),
    ).toBe(INGRESS);
  });

  it("normalizes IPv4-mapped IPv6 peers so a CIDR still matches", () => {
    expect(normalizeIp("::ffff:10.0.0.1")).toBe("10.0.0.1");
    expect(
      resolve({
        peerAddress: "::ffff:10.0.0.1",
        forwardedFor: CLIENT,
        trustedProxies: ["10.0.0.0/8"],
      }),
    ).toBe(CLIENT);
  });

  it("reuses one matcher across requests (hoisted BlockList)", () => {
    const isTrusted = createTrustedProxyMatcher([INGRESS, "10.0.0.0/8"]);
    expect(
      resolveClientIp({
        peerAddress: INGRESS,
        forwardedFor: CLIENT,
        isTrusted,
      }),
    ).toBe(CLIENT);
    expect(
      resolveClientIp({
        peerAddress: "10.8.1.4",
        forwardedFor: CLIENT,
        isTrusted,
      }),
    ).toBe(CLIENT);
    expect(
      resolveClientIp({
        peerAddress: PEER,
        forwardedFor: SPOOF,
        isTrusted,
      }),
    ).toBe(PEER);
  });
});
