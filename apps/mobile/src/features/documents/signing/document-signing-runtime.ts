/**
 * Web export stub (SHO-260). Nitro UAPKI is native-only. `expo export:web`
 * must not import `@showzy/document-signing/native`.
 */
import {
  SigningUnavailableError,
  type DocumentSigningPorts,
} from "./signing-pipeline";

export type DocumentSigningEngine = Pick<
  DocumentSigningPorts,
  "inspectKey" | "digestPayload" | "signManifest"
>;

async function unavailable(): Promise<never> {
  return Promise.reject(new SigningUnavailableError());
}

export function createDocumentSigningEngine(
  corsProxyUrl: string,
): Promise<DocumentSigningEngine> {
  void corsProxyUrl;
  return Promise.resolve({
    inspectKey: () => unavailable(),
    digestPayload: () => unavailable(),
    signManifest: () => unavailable(),
  });
}
