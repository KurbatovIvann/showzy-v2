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
  /** Validated `TRUSTED_PROXIES` entries (IPs and CIDRs). */
  readonly trustedProxies: readonly string[];
}

/**
 * Walks `X-Forwarded-For` from the right, skipping hops that are themselves
 * trusted proxies, and returns the first untrusted address — the client the
 * ingress actually observed. An untrusted peer never gets to name its own IP.
 */
export function resolveClientIp(input: ResolveClientIpInput): string {
  const peer = normalizeIp(input.peerAddress);
  if (
    input.trustedProxies.length === 0 ||
    !isTrusted(peer, input.trustedProxies)
  ) {
    return peer;
  }

  const hops = parseForwardedFor(input.forwardedFor);
  for (let i = hops.length - 1; i >= 0; i -= 1) {
    const hop = hops[i];
    if (hop !== undefined && !isTrusted(hop, input.trustedProxies)) {
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

/** Strip brackets, IPv6 zone ids, and IPv4-mapped IPv6 so BlockList can match. */
export function normalizeIp(address: string): string {
  const trimmed = address.trim().replace(/^\[/, "").replace(/\]$/, "");
  const withoutZone = trimmed.replace(/%.+$/, "");
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(withoutZone);
  return mapped?.[1] ?? withoutZone;
}

function isTrusted(
  address: string,
  trustedProxies: readonly string[],
): boolean {
  const ipType = address.includes(":") ? "ipv6" : "ipv4";
  const list = new BlockList();
  for (const entry of trustedProxies) {
    try {
      addTrustedEntry(list, entry);
    } catch {
      // Config already validated the list; a malformed runtime value must
      // not fail the request open — skip that entry.
    }
  }
  try {
    return list.check(address, ipType);
  } catch {
    return false;
  }
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
