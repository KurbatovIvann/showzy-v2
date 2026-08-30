import type { HybridObject } from "react-native-nitro-modules";

/**
 * Nitro Module spec for the UAPKI crypto engine.
 *
 * Exposes the minimal C ABI: `process(json) -> json`.
 * All signing operations are driven through JSON-RPC commands
 * serialized by the TypeScript layer (DocumentSigner).
 */
export interface UapkiEngine extends HybridObject<{
  ios: "c++";
  android: "c++";
}> {
  /**
   * Send a JSON-RPC request to the UAPKI engine and receive the response.
   * Runs on a background thread (Nitro ThreadPool) so the JS thread remains
   * free to handle HTTP callbacks from the engine (OCSP, TSP, CRL).
   */
  process(jsonRequest: string): Promise<string>;

  /**
   * Register a JS callback that handles HTTP requests from the native
   * UAPKI engine (OCSP, TSP, CRL). The callback receives a JSON string
   * `{"method":"GET"|"POST","url":"...","contentType":"...","bodyBase64":"..."}`
   * and must return `{"status":200,"bodyBase64":"..."}`.
   *
   * The callback is async -- it is invoked on the JS thread via CallInvoker
   * while `process()` blocks on a ThreadPool thread waiting for the result.
   */
  setHttpHandler(handler: (jsonRequest: string) => Promise<string>): void;
}
