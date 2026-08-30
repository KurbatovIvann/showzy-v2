import { isPkiProxyAllowedHost } from "./allowlist.js";
import {
  extractCertsFromPkcs7,
  unwrapContentInfo,
  wrapInContentInfo,
} from "./asn1.js";
import { base64ToUint8, hexToBytes, leU32, uint8ToBase64 } from "./encoding.js";
import { unwrapProxyResponse } from "./proxy.js";

const IIT_PAYLOAD_SIZE = 120;
const IIT_OP_CODE = 13;
const IIT_HEADER_SIZE = 8;

/**
 * Fetch user certificates from the given CAs using the IIT CMP protocol.
 * Tries every CA in parallel, returns all discovered certs.
 *
 * Every request goes through the SHO-255 proxy, whose static allowlist is
 * `isPkiProxyAllowedHost`. CMP URLs from the downloaded CZO registry that
 * fall outside it are skipped up front — the proxy would reject them anyway,
 * and each attempt logs a "pki proxy blocked" warning on the API.
 */
export async function fetchUserCerts(
  keyIdsHex: string[],
  cmpUrls: string[],
  corsProxyUrl: string,
): Promise<Uint8Array[]> {
  if (keyIdsHex.length === 0) return [];

  const proxyableUrls = cmpUrls.filter(isProxyableCmpUrl);

  const results = await Promise.allSettled(
    proxyableUrls.map((url) => fetchCertsFromCa(url, keyIdsHex, corsProxyUrl)),
  );

  const allCerts: Uint8Array[] = [];
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.length > 0) {
      allCerts.push(...r.value);
    }
  }

  return allCerts;
}

function isProxyableCmpUrl(cmpUrl: string): boolean {
  try {
    return isPkiProxyAllowedHost(new URL(cmpUrl).hostname);
  } catch {
    return false;
  }
}

async function fetchCertsFromCa(
  cmpUrl: string,
  keyIdsHex: string[],
  corsProxyUrl: string,
): Promise<Uint8Array[]> {
  const requestBytes = buildCertRequest(keyIdsHex);
  const requestB64 = uint8ToBase64(requestBytes);

  const proxyResp = await fetch(corsProxyUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: cmpUrl,
      contentType: "application/pkixcmp",
      body: requestB64,
    }),
  });

  if (!proxyResp.ok) return [];

  const raw: unknown = await proxyResp.json();
  const proxyData = unwrapProxyResponse(raw);

  if (proxyData.status !== 200 || !proxyData.bodyBase64) return [];

  const responseBytes = base64ToUint8(proxyData.bodyBase64);
  return parseCmpResponse(responseBytes);
}

function buildCertRequest(keyIdsHex: string[]): Uint8Array {
  const keyIdBytes = keyIdsHex.map(hexToBytes);
  const inner = new Uint8Array(IIT_PAYLOAD_SIZE);

  inner[0] = IIT_OP_CODE;

  const count = keyIdBytes.length;
  inner[8] = count & 0xff;
  inner[9] = (count >> 8) & 0xff;
  inner[10] = (count >> 16) & 0xff;
  inner[11] = (count >> 24) & 0xff;

  let offset = 12;
  for (const kb of keyIdBytes) {
    inner.set(kb, offset);
    offset += kb.length;
  }

  return wrapInContentInfo(inner);
}

function parseCmpResponse(data: Uint8Array): Uint8Array[] {
  if (data.length < 2 || data[0] !== 0x30) return [];

  const inner = unwrapContentInfo(data);
  if (!inner || inner.length < IIT_HEADER_SIZE) return [];

  const opCode = leU32(inner, 0);
  if (opCode !== IIT_OP_CODE) return [];

  if (inner.length <= IIT_HEADER_SIZE) return [];

  const certData = inner.subarray(IIT_HEADER_SIZE);
  if (certData[0] !== 0x30) return [];

  const certs = extractCertsFromPkcs7(certData);
  if (certs.length > 0) return certs;

  if (certData.length > 200) {
    return [certData.slice()];
  }

  return [];
}
