/**
 * Native Nitro engine (SHO-260). `DocumentSigner` + `createNativeAdapter`.
 * DIGEST of the PDF uses the adapter `process` path (GOST / Kupyna);
 * CAdES is of the ASiCManifest, not the payload. Key bytes never log.
 */
import { DocumentSigner, InvalidPasswordError } from "@showzy/document-signing";
import { createNativeAdapter } from "@showzy/document-signing/native";

import {
  SigningPasswordError,
  SigningUnavailableError,
  type DocumentSigningPorts,
} from "./signing-pipeline";

export type DocumentSigningEngine = Pick<
  DocumentSigningPorts,
  "inspectKey" | "digestPayload" | "signManifest"
>;

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(binary);
}

function base64ToUint8(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const record: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    record[key] = entry;
  }
  return record;
}

type NitroAdapter = ReturnType<typeof createNativeAdapter>;

type EngineState = {
  readonly adapter: NitroAdapter;
  readonly signer: DocumentSigner;
};

let engine: Promise<EngineState> | null = null;

async function loadEngine(corsProxyUrl: string): Promise<EngineState> {
  const adapter = createNativeAdapter();
  const signer = await DocumentSigner.create(adapter, { corsProxyUrl });
  return { adapter, signer };
}

export async function createDocumentSigningEngine(
  corsProxyUrl: string,
): Promise<DocumentSigningEngine> {
  try {
    engine ??= loadEngine(corsProxyUrl);
    const current = await engine;
    return {
      inspectKey: async ({ keyBytes, password }) => {
        try {
          const result = await current.signer.validateKey(keyBytes, password);
          return {
            certAlgorithm: result.certInfo.algorithm,
            certCommonName: result.certInfo.commonName,
          };
        } catch (error: unknown) {
          if (error instanceof InvalidPasswordError) {
            throw new SigningPasswordError();
          }
          throw error;
        }
      },
      digestPayload: async (bytes, hashOid) => {
        const response = await current.adapter.process(
          JSON.stringify({
            method: "DIGEST",
            parameters: {
              hashAlgo: hashOid,
              bytes: uint8ToBase64(bytes),
            },
          }),
        );
        if (response.errorCode !== 0) {
          throw new SigningUnavailableError();
        }
        const digestB64 = asRecord(response.result).bytes;
        if (typeof digestB64 !== "string" || digestB64.length === 0) {
          throw new SigningUnavailableError();
        }
        return digestB64;
      },
      signManifest: async ({ keyBytes, password, manifest }) => {
        try {
          const signed = await current.signer.signDocument(
            keyBytes,
            password,
            manifest,
            {
              signatureFormat: "CAdES-BES",
              isDetached: true,
              includeCert: true,
              includeTime: true,
              includeContentTs: false,
            },
          );
          return base64ToUint8(signed.p7sBase64);
        } catch (error: unknown) {
          if (error instanceof InvalidPasswordError) {
            throw new SigningPasswordError();
          }
          throw error;
        }
      },
    };
  } catch (error: unknown) {
    engine = null;
    if (error instanceof SigningPasswordError) {
      throw error;
    }
    throw new SigningUnavailableError();
  }
}
