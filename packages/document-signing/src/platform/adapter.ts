import type { UapkiResponse } from "../types.js";

/**
 * Platform-specific adapter for the UAPKI engine.
 * Web uses WASM in a Web Worker; React Native uses Nitro Modules.
 */
export interface UapkiAdapter {
  initialize(options: AdapterInitOptions): Promise<void>;
  process(jsonRequest: string): Promise<UapkiResponse>;
  writeFile(path: string, data: Uint8Array): Promise<void>;
  deleteFile(path: string): Promise<void>;
  destroy(): Promise<void>;
  /** Platform-specific temp directory prefix. Empty string for WASM-based adapters. */
  readonly tempDir: string;
}

export interface AdapterInitOptions {
  corsProxyUrl?: string;
  wasmLocateFile?: (path: string) => string;
}
