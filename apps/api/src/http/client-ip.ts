/**
 * Trusted-proxy IP normalization (security-operations §2). Forwarded-IP
 * headers are consulted only when the immediate peer is in the configured
 * ingress list; a spoofed `X-Forwarded-For` from an untrusted client is
 * ignored. The result is transport-only: rate limiting HMAC-keys it, and
 * it never becomes a domain log or audit field.
 */
import { BlockList, isIP } from "node:net";

export interface ResolveClientIpInput {
  /** The TCP peer as the process saw it (socket address). */
  readonly peerAddress: string;
  /** Raw `X-Forwarded-For` header; ignored unless the peer is trusted. */
  readonly forwardedFor: string | undefined;
  /**
   * Pre-built matcher from {@link createTrustedProxyMatcher}. Prefer this
   * on the request hot path — constructing `BlockList` per request is waste.
   */
  readonly isTrusted: (address: string) => boolean;
}

/**
 * Builds a reusable trusted-proxy matcher at app construction. `TRUSTED_PROXIES`
 * is static config; the `BlockList` does not change per request.
 */
export function createTrustedProxyMatcher(
  trustedProxies: readonly string[],
): (address: string) => boolean {
  const list = new BlockList();
  for (const entry of trustedProxies) {
    try {
      addTrustedEntry(list, entry);
    } catch {
      // Config already validated the list; a malformed runtime value must
      // not fail the request open — skip that entry.
    }
  }
  return (address: string): boolean => {
    const ipType = address.includes(":") ? "ipv6" : "ipv4";
    try {
      return list.check(address, ipType);
    } catch {
      return false;
    }
  };
}

/**
 * Walks `X-Forwarded-For` from the right, skipping hops that are themselves
 * trusted proxies, and returns the first untrusted address — the client the
 * ingress actually observed. An untrusted peer never gets to name its own IP.
 */
export function resolveClientIp(input: ResolveClientIpInput): string {
  const peer = normalizeIp(input.peerAddress);
  if (!input.isTrusted(peer)) {
    return peer;
  }

  const hops = parseForwardedFor(input.forwardedFor);
  for (let i = hops.length - 1; i >= 0; i -= 1) {
    const hop = hops[i];
    if (hop !== undefined && !input.isTrusted(hop)) {
      return hop;
    }
  }
  return hops[0] ?? peer;
}

function parseForwardedFor(header: string | undefined): string[] {
  if (header === undefined || header.trim() === "") {
    return [];
  }
  return header
    .split(",")
    .map((entry) => normalizeIp(entry))
    .filter((entry) => entry.length > 0);
}

/**
 * Strip brackets, IPv6 zone ids, and reduce IPv4-mapped, IPv4-compatible,
 * IPv4-translated, NAT64 well-known, and 6to4 encodings to IPv4 so BlockList
 * can match. Native `::` / `::1` stay IPv6. Unparseable input is returned as
 * stripped text (callers that must fail closed use
 * {@link tryCanonicalDestinationIp}).
 */
export function normalizeIp(address: string): string {
  const stripped = stripIp(address);
  return tryCanonicalDestinationIp(address) ?? stripped;
}

/**
 * Canonical IPv4 or native IPv6 for destination BlockList checks.
 * `null` means the address could not be parsed (fail closed).
 */
export function tryCanonicalDestinationIp(address: string): string | null {
  const stripped = stripIp(address);
  const embedded = embeddedIpv4(stripped);
  if (embedded !== null) {
    return embedded;
  }
  if (isIP(stripped) === 4) {
    return stripped;
  }
  if (parseIpv6Hextets(stripped) !== null) {
    return stripped;
  }
  return null;
}

function stripIp(address: string): string {
  const trimmed = address.trim().replace(/^\[/, "").replace(/\]$/, "");
  return trimmed.replace(/%.+$/, "");
}

const DOTTED_IPV4_SUFFIX = /^(.+):(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const HEX_GROUP = /^[0-9a-f]{1,4}$/i;

function hextetAt(hextets: readonly number[], index: number): number {
  return hextets[index] ?? 0;
}

function embeddedIpv4(address: string): string | null {
  const hextets = parseIpv6Hextets(address);
  if (hextets === null || hextets.length !== 8) {
    return null;
  }
  const g0 = hextetAt(hextets, 0);
  const g1 = hextetAt(hextets, 1);
  const g2 = hextetAt(hextets, 2);
  const g3 = hextetAt(hextets, 3);
  const g4 = hextetAt(hextets, 4);
  const g5 = hextetAt(hextets, 5);
  const g6 = hextetAt(hextets, 6);
  const g7 = hextetAt(hextets, 7);

  // IPv4-mapped: ::ffff:a.b.c.d (80 bits 0 + ffff + IPv4)
  if (
    g0 === 0 &&
    g1 === 0 &&
    g2 === 0 &&
    g3 === 0 &&
    g4 === 0 &&
    g5 === 0xffff
  ) {
    return hextetsToIpv4(g6, g7);
  }
  // IPv4-translated: ::ffff:0:a.b.c.d (64 bits 0 + ffff + 0 + IPv4)
  if (
    g0 === 0 &&
    g1 === 0 &&
    g2 === 0 &&
    g3 === 0 &&
    g4 === 0xffff &&
    g5 === 0
  ) {
    return hextetsToIpv4(g6, g7);
  }
  // IPv4-compatible: ::a.b.c.d except native :: / ::1
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) {
    const ipv4 = hextetsToIpv4(g6, g7);
    if (ipv4 === "0.0.0.0" || ipv4 === "0.0.0.1") {
      return null;
    }
    return ipv4;
  }
  // NAT64 well-known prefix 64:ff9b::/96
  if (
    g0 === 0x64 &&
    g1 === 0xff9b &&
    g2 === 0 &&
    g3 === 0 &&
    g4 === 0 &&
    g5 === 0
  ) {
    return hextetsToIpv4(g6, g7);
  }
  // 6to4 2002:aabb:ccdd::/48
  if (g0 === 0x2002) {
    return hextetsToIpv4(g1, g2);
  }
  return null;
}

function parseIpv6Hextets(address: string): number[] | null {
  const rewritten = rewriteDottedIpv4Suffix(address);
  if (rewritten === null) {
    return null;
  }
  const compressionCount = rewritten.split("::").length - 1;
  if (compressionCount > 1) {
    return null;
  }
  if (compressionCount === 1) {
    const parts = rewritten.split("::");
    const left = parseHexGroups(parts[0] ?? "");
    const right = parseHexGroups(parts[1] ?? "");
    if (left === null || right === null) {
      return null;
    }
    const missing = 8 - left.length - right.length;
    if (missing < 1) {
      return null;
    }
    return [...left, ...Array.from({ length: missing }, () => 0), ...right];
  }
  const groups = parseHexGroups(rewritten);
  if (groups === null || groups.length !== 8) {
    return null;
  }
  return groups;
}

function rewriteDottedIpv4Suffix(address: string): string | null {
  const match = DOTTED_IPV4_SUFFIX.exec(address);
  if (match === null) {
    return address;
  }
  const octets = [match[2], match[3], match[4], match[5]].map(Number);
  if (octets.some((octet) => octet > 255)) {
    return null;
  }
  const prefix = match[1];
  if (prefix === undefined) {
    return null;
  }
  const high = ((octets[0] ?? 0) << 8) | (octets[1] ?? 0);
  const low = ((octets[2] ?? 0) << 8) | (octets[3] ?? 0);
  return `${prefix}:${high.toString(16)}:${low.toString(16)}`;
}

function parseHexGroups(part: string): number[] | null {
  if (part === "") {
    return [];
  }
  const groups: number[] = [];
  for (const group of part.split(":")) {
    if (!HEX_GROUP.test(group)) {
      return null;
    }
    groups.push(Number.parseInt(group, 16));
  }
  return groups;
}

function hextetsToIpv4(high: number, low: number): string {
  return [(high >> 8) & 255, high & 255, (low >> 8) & 255, low & 255].join(".");
}

function addTrustedEntry(list: BlockList, entry: string): void {
  if (entry.includes("/")) {
    const slash = entry.lastIndexOf("/");
    const network = entry.slice(0, slash);
    const bits = Number(entry.slice(slash + 1));
    const ipType = network.includes(":") ? "ipv6" : "ipv4";
    list.addSubnet(network, bits, ipType);
    return;
  }
  const ipType = entry.includes(":") ? "ipv6" : "ipv4";
  list.addAddress(entry, ipType);
}
