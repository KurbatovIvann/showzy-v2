/**
 * Trusted-proxy IP normalization (security-operations §2). Forwarded-IP
 * headers are consulted only when the immediate peer is in the configured
 * ingress list; a spoofed `X-Forwarded-For` from an untrusted client is
 * ignored. The result is transport-only: rate limiting HMAC-keys it, and
 * it never becomes a domain log or audit field.
 */
import { BlockList } from "node:net";

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
 * Strip brackets, IPv6 zone ids, and reduce IPv4-mapped / IPv4-compatible
 * IPv6 (shorthand, long-form, and hex) to IPv4 so BlockList can match.
 * Native `::` / `::1` stay IPv6.
 */
export function normalizeIp(address: string): string {
  const trimmed = address.trim().replace(/^\[/, "").replace(/\]$/, "");
  const withoutZone = trimmed.replace(/%.+$/, "");
  return embeddedIpv4(withoutZone) ?? withoutZone;
}

const DOTTED_IPV4_SUFFIX = /^(.+):(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const HEX_GROUP = /^[0-9a-f]{1,4}$/i;

function embeddedIpv4(address: string): string | null {
  const hextets = parseIpv6Hextets(address);
  if (hextets === null || hextets.length !== 8) {
    return null;
  }
  const prefixZero =
    hextets[0] === 0 &&
    hextets[1] === 0 &&
    hextets[2] === 0 &&
    hextets[3] === 0 &&
    hextets[4] === 0;
  if (!prefixZero) {
    return null;
  }
  const sixth = hextets[5] ?? 0;
  const seventh = hextets[6] ?? 0;
  const eighth = hextets[7] ?? 0;
  if (sixth === 0xffff) {
    return hextetsToIpv4(seventh, eighth);
  }
  if (sixth === 0) {
    const ipv4 = hextetsToIpv4(seventh, eighth);
    if (ipv4 === "0.0.0.0" || ipv4 === "0.0.0.1") {
      return null;
    }
    return ipv4;
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
