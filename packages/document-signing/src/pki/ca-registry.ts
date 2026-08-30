import { extractCertsFromPkcs7 } from "./asn1.js";
import { base64ToUint8 } from "./encoding.js";
import { proxyFetch } from "./proxy.js";

export interface CaProvider {
  id: string;
  name: string;
  issuerCNs: string[];
  cmpUrl: string;
  ocspUrl: string;
  tsaUrl: string;
}

interface CzoJsonEntry {
  issuerCNs: string[];
  address: string;
  ocspAccessPointAddress: string;
  ocspAccessPointPort: string;
  cmpAddress: string;
  tspAddress: string;
  tspAddressPort: string;
  directAccess?: boolean;
  codeEDRPOU?: string;
}

const DEFAULT_CZO_CAS_JSON_URL =
  "https://czo.gov.ua/download/certificates/CAs.json";
const DEFAULT_CZO_CA_BUNDLE_URL =
  "https://czo.gov.ua/download/certificates/CACertificates.p7b";

let cachedProviders: CaProvider[] | null = null;

function mapCzoEntry(entry: CzoJsonEntry): CaProvider {
  const cmpHost = entry.cmpAddress || entry.address;
  return {
    id: entry.address,
    name: entry.issuerCNs[0] ?? entry.address,
    issuerCNs: entry.issuerCNs,
    cmpUrl: `http://${cmpHost}/services/cmp/`,
    ocspUrl: `http://${entry.ocspAccessPointAddress}`,
    tsaUrl: `http://${entry.tspAddress}/services/tsp/`,
  };
}

export async function loadCaRegistry(
  corsProxyUrl: string,
  casJsonUrl = DEFAULT_CZO_CAS_JSON_URL,
): Promise<CaProvider[]> {
  if (cachedProviders) return cachedProviders;

  try {
    const proxyData = await proxyFetch(corsProxyUrl, casJsonUrl);
    if (proxyData.status !== 200 || !proxyData.bodyBase64) {
      throw new Error(`CAs.json: status=${String(proxyData.status)}`);
    }

    const jsonText = new TextDecoder().decode(
      base64ToUint8(proxyData.bodyBase64),
    );
    const parsed: unknown = JSON.parse(jsonText);
    if (!Array.isArray(parsed)) {
      throw new Error("CAs.json is not an array");
    }
    cachedProviders = parsed.map((entry) => mapCzoEntry(entry as CzoJsonEntry));
    return cachedProviders;
  } catch {
    cachedProviders = FALLBACK_CA_PROVIDERS;
    return cachedProviders;
  }
}

export function getAllCaProviders(): CaProvider[] {
  return cachedProviders ?? FALLBACK_CA_PROVIDERS;
}

export function getAllCmpUrls(): string[] {
  return getAllCaProviders().map((ca) => ca.cmpUrl);
}

export function findCaByIssuerCn(issuerCn: string): CaProvider | undefined {
  const cn = issuerCn.toLowerCase();
  return getAllCaProviders().find((ca) =>
    ca.issuerCNs.some((name) => {
      const lower = name.toLowerCase();
      return cn.includes(lower) || lower.includes(cn);
    }),
  );
}

export async function fetchCaCertBundle(
  corsProxyUrl: string,
  caBundleUrl = DEFAULT_CZO_CA_BUNDLE_URL,
): Promise<string | null> {
  try {
    const proxyData = await proxyFetch(corsProxyUrl, caBundleUrl);
    if (proxyData.status === 200 && proxyData.bodyBase64) {
      return proxyData.bodyBase64;
    }
  } catch {
    /* fall through */
  }
  return null;
}

export async function fetchCaCerts(
  corsProxyUrl: string,
  caBundleUrl = DEFAULT_CZO_CA_BUNDLE_URL,
): Promise<Uint8Array[]> {
  try {
    const proxyData = await proxyFetch(corsProxyUrl, caBundleUrl);
    if (proxyData.status !== 200 || !proxyData.bodyBase64) {
      throw new Error(`CACertificates.p7b: status=${String(proxyData.status)}`);
    }

    const bytes = base64ToUint8(proxyData.bodyBase64);
    const certs = extractCertsFromPkcs7(bytes);
    if (certs.length > 0) return certs;
    throw new Error("No certs extracted from p7b");
  } catch {
    return fetchFallbackCaCerts(corsProxyUrl);
  }
}

async function fetchFallbackCaCerts(
  corsProxyUrl: string,
): Promise<Uint8Array[]> {
  const urls = FALLBACK_CA_PROVIDERS.flatMap((ca) => ca.certUrls);
  const results: Uint8Array[] = [];

  for (const url of urls) {
    try {
      const proxyData = await proxyFetch(corsProxyUrl, url);
      if (proxyData.status !== 200 || !proxyData.bodyBase64) continue;
      results.push(base64ToUint8(proxyData.bodyBase64));
    } catch {
      // best-effort
    }
  }

  return results;
}

interface FallbackCaProvider extends CaProvider {
  certUrls: string[];
}

const FALLBACK_CA_PROVIDERS: FallbackCaProvider[] = [
  {
    id: "ca.monobank.ua",
    name: "АЦСК АТ «Універсал Банк» (monobank)",
    issuerCNs: ["КНЕДП АТ «УНІВЕРСАЛ БАНК»", "QTSP UNIVERSALBANK JSC"],
    certUrls: [
      "https://ca.monobank.ua/certs/CA-1.cer",
      "https://ca.monobank.ua/certs/CA-DFS1.cer",
    ],
    cmpUrl: "http://ca.monobank.ua/services/cmp/",
    ocspUrl: "http://ca.monobank.ua/services/ocsp/",
    tsaUrl: "http://ca.monobank.ua/services/tsp/",
  },
  {
    id: "acsk.privatbank.ua",
    name: "АЦСК ПАТ КБ «Приватбанк»",
    issuerCNs: ["КНЕДП АТ КБ «ПРИВАТБАНК»", "QTSP AT CB PRIVATBANK"],
    certUrls: ["https://acsk.privatbank.ua/certs/CA-Privatbank-2023.cer"],
    cmpUrl: "http://acsk.privatbank.ua/services/cmp/",
    ocspUrl: "http://acsk.privatbank.ua/services/ocsp/",
    tsaUrl: "http://acsk.privatbank.ua/services/tsp/",
  },
  {
    id: "ca.informjust.ua",
    name: "«Дія». КНЕДП",
    issuerCNs: [
      '"Дія". Кваліфікований надавач електронних довірчих послуг',
      '"DIIA". Qualified Trust Services Provider',
      "АЦСК органів юстиції України",
    ],
    certUrls: ["https://czo.gov.ua/download/certificates/CA-Diia-2023.cer"],
    cmpUrl: "http://ca.informjust.ua/services/cmp/",
    ocspUrl: "http://czo.gov.ua/services/ocsp/",
    tsaUrl: "http://czo.gov.ua/services/tsp/",
  },
  {
    id: "ca.tax.gov.ua",
    name: "КНЕДП ДПС",
    issuerCNs: [
      "КНЕДП ДПС",
      "QTSP State Tax Service of Ukraine",
      "КНЕДП ІДД ДПС",
    ],
    certUrls: ["https://acskidd.gov.ua/download/certificates/CA-DPS-2023.cer"],
    cmpUrl: "http://ca.tax.gov.ua/services/cmp/",
    ocspUrl: "http://ca.tax.gov.ua/services/ocsp/",
    tsaUrl: "http://ca.tax.gov.ua/services/tsp/",
  },
  {
    id: "czo.gov.ua",
    name: "ЦЗО ДП «Дія»",
    issuerCNs: [
      "Центральний засвідчувальний орган",
      "Central Certification Authority",
    ],
    certUrls: ["https://czo.gov.ua/download/certificates/CZO-2023.cer"],
    cmpUrl: "http://czo.gov.ua/services/cmp/",
    ocspUrl: "http://czo.gov.ua/services/ocsp/",
    tsaUrl: "http://czo.gov.ua/services/tsp/",
  },
];
