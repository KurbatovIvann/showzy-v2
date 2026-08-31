import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { pkiDebugLog } from "../pki/debug-log.js";
import { parseUapkiResponseJson } from "../pki/uapki-json.js";
import type { UapkiResponse } from "../types.js";
import type { AdapterInitOptions, UapkiAdapter } from "./adapter.js";
import { applyWasmCorsProxy, nodeAdapterHttpPlan } from "./http-init.js";

const require = createRequire(import.meta.url);
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

interface UapkiModule {
  cwrap: (
    name: string,
    returnType: string,
    argTypes: string[],
  ) => (...args: unknown[]) => unknown;
  UTF8ToString: (ptr: number) => string;
  stringToUTF8: (str: string, ptr: number, maxLen: number) => void;
  lengthBytesUTF8: (str: string) => number;
  _malloc: (size: number) => number;
  _free: (ptr: number) => void;
  FS: {
    mkdir: (path: string) => void;
    writeFile: (path: string, data: Uint8Array) => void;
    readFile: (path: string) => Uint8Array;
    unlink: (path: string) => void;
  };
}

type CreateUapkiModule = (options?: {
  locateFile?: (path: string) => string;
}) => Promise<UapkiModule>;

function loadCreateUapkiModule(wasmJsPath: string): CreateUapkiModule {
  const loaded: unknown = require(wasmJsPath);
  if (typeof loaded === "function") {
    return loaded as CreateUapkiModule;
  }
  if (typeof loaded === "object" && loaded !== null && "default" in loaded) {
    const factory = loaded.default;
    if (typeof factory === "function") {
      return factory as CreateUapkiModule;
    }
  }
  throw new Error(`UAPKI WASM factory not found at ${wasmJsPath}`);
}

/**
 * Node.js platform adapter that runs UAPKI WASM directly in the main process.
 * Suitable for server-side operations like digest computation, signature
 * verification, and certificate parsing where no private key is involved.
 */
export class NodeAdapter implements UapkiAdapter {
  readonly tempDir = "";
  private module: UapkiModule | null = null;
  private processFunc: ((jsonPtr: number) => number) | null = null;
  private jsonFreeFunc: ((ptr: number) => void) | null = null;

  private wasmDir: string;

  constructor(wasmDir?: string) {
    this.wasmDir = wasmDir ?? join(packageRoot, "wasm", "dist");
  }

  async initialize(options: AdapterInitOptions): Promise<void> {
    if (this.module) {
      throw new Error("NodeAdapter already initialized");
    }

    const wasmJsPath = join(this.wasmDir, "uapki.js");
    if (!existsSync(wasmJsPath)) {
      throw new Error(
        `UAPKI WASM not found at ${wasmJsPath}. Run "pnpm build:wasm" in @showzy/document-signing first.`,
      );
    }

    const createUapkiModule = loadCreateUapkiModule(wasmJsPath);

    this.module = await createUapkiModule({
      locateFile: (path: string) => join(this.wasmDir, path),
    });

    const processWrapped = this.module.cwrap("process", "number", ["number"]);
    this.processFunc = (ptr: number) => {
      const result = processWrapped(ptr);
      if (typeof result !== "number") {
        throw new Error("UAPKI process() returned a non-number pointer");
      }
      return result;
    };
    const jsonFreeWrapped = this.module.cwrap("json_free", "void", ["number"]);
    this.jsonFreeFunc = (ptr: number) => {
      jsonFreeWrapped(ptr);
    };

    const { corsProxyUrl, initRequest } = nodeAdapterHttpPlan(options);
    applyWasmCorsProxy(this.module.cwrap, corsProxyUrl);

    for (const dir of ["/tmp", "/certs", "/crl"]) {
      try {
        this.module.FS.mkdir(dir);
      } catch {
        // already exists
      }
    }

    const initResult = this.callRaw(initRequest);

    if (initResult.errorCode !== 0) {
      throw new Error(
        `UAPKI INIT failed: ${initResult.error ?? String(initResult.errorCode)}`,
      );
    }
  }

  process(jsonRequest: string): Promise<UapkiResponse> {
    // The request JSON is produced by this package's own callers.
    const request: unknown = JSON.parse(jsonRequest);
    if (typeof request !== "object" || request === null) {
      throw new Error("UAPKI request must be a JSON object");
    }
    return Promise.resolve(this.callRaw(request));
  }

  writeFile(path: string, data: Uint8Array): Promise<void> {
    if (!this.module) throw new Error("NodeAdapter not initialized");
    this.module.FS.writeFile(path, data);
    return Promise.resolve();
  }

  deleteFile(path: string): Promise<void> {
    if (!this.module) throw new Error("NodeAdapter not initialized");
    try {
      this.module.FS.unlink(path);
    } catch (error) {
      // best effort
      pkiDebugLog(`node-adapter: unlink failed (${path})`, error);
    }
    return Promise.resolve();
  }

  destroy(): Promise<void> {
    if (this.module) {
      this.callRaw({ method: "DEINIT" });
      this.module = null;
      this.processFunc = null;
      this.jsonFreeFunc = null;
    }
    return Promise.resolve();
  }

  private callRaw(request: object): UapkiResponse {
    if (!this.module || !this.processFunc || !this.jsonFreeFunc) {
      throw new Error("WASM module not initialized");
    }

    const jsonStr = JSON.stringify(request);
    const len = this.module.lengthBytesUTF8(jsonStr) + 1;
    const ptr = this.module._malloc(len);
    this.module.stringToUTF8(jsonStr, ptr, len);

    const resultPtr = this.processFunc(ptr);
    this.module._free(ptr);

    if (!resultPtr) {
      throw new Error("UAPKI process() returned null");
    }

    const resultStr = this.module.UTF8ToString(resultPtr);
    this.jsonFreeFunc(resultPtr);

    return parseUapkiResponseJson(resultStr, "node-adapter");
  }
}

export function createNodeAdapter(wasmDir?: string): UapkiAdapter {
  return new NodeAdapter(wasmDir);
}
