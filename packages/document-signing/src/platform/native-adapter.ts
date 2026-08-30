import { Directory, File, Paths } from "expo-file-system";

import { unwrapProxyResponse } from "../pki/proxy.js";
import type { UapkiEngine } from "../specs/uapki.nitro.js";
import type { UapkiResponse } from "../types.js";
import type { AdapterInitOptions, UapkiAdapter } from "./adapter.js";

interface NitroModulesApi {
  createHybridObject(name: string): UapkiEngine;
}

function loadNitroModules(): { NitroModules: NitroModulesApi } {
  const req = (globalThis as { require?: (id: string) => unknown }).require;
  if (typeof req !== "function") {
    throw new Error(
      "Failed to load UapkiEngine Nitro Module. Ensure react-native-nitro-modules and the native UAPKI module are properly installed.",
    );
  }
  const loaded: unknown = req("react-native-nitro-modules");
  if (
    typeof loaded !== "object" ||
    loaded === null ||
    !("NitroModules" in loaded)
  ) {
    throw new Error(
      "Failed to load UapkiEngine Nitro Module. Ensure react-native-nitro-modules and the native UAPKI module are properly installed.",
    );
  }
  return loaded as { NitroModules: NitroModulesApi };
}

/**
 * React Native platform adapter that calls UAPKI via Nitro Modules.
 *
 * `process()` runs on a Nitro ThreadPool thread so the JS thread stays free
 * to handle HTTP callbacks (OCSP, TSP, CRL) dispatched back via CallInvoker.
 */
export class NativeAdapter implements UapkiAdapter {
  readonly tempDir: string;
  private engine: UapkiEngine | null = null;

  constructor() {
    const cacheUri = Paths.cache.uri;
    if (!cacheUri) {
      throw new Error("expo-file-system: cache directory is not available");
    }
    const fsPath = cacheUri.replace(/^file:\/\//, "");
    this.tempDir = fsPath.endsWith("/") ? fsPath : `${fsPath}/`;
  }

  async initialize(options: AdapterInitOptions): Promise<void> {
    if (this.engine) {
      throw new Error("NativeAdapter already initialized");
    }

    const { NitroModules } = loadNitroModules();
    this.engine = NitroModules.createHybridObject("UapkiEngine");

    const uapkiDir = new Directory(Paths.cache, "uapki");
    const certsDir = new Directory(uapkiDir, "certs");
    const crlDir = new Directory(uapkiDir, "crl");

    uapkiDir.create({ idempotent: true });
    certsDir.create({ idempotent: true });
    crlDir.create({ idempotent: true });

    if (options.corsProxyUrl) {
      this.engine.setHttpHandler(createHttpHandler(options.corsProxyUrl));
    }

    const initRequest = JSON.stringify({
      method: "INIT",
      parameters: {
        cmProviders: {
          dir: "",
          allowedProviders: [{ lib: "cm-pkcs12" }],
        },
        certCache: { path: `${this.tempDir}uapki/certs/` },
        crlCache: { path: `${this.tempDir}uapki/crl/` },
        offline: false,
      },
    });

    let initResult = await this.engine.process(initRequest);
    let parsed = JSON.parse(initResult) as UapkiResponse;

    if (
      parsed.errorCode !== 0 &&
      (parsed.error ?? "").includes("ALREADY_INITIALIZED")
    ) {
      await this.engine.process(JSON.stringify({ method: "DEINIT" }));
      initResult = await this.engine.process(initRequest);
      parsed = JSON.parse(initResult) as UapkiResponse;
    }

    if (parsed.errorCode !== 0) {
      throw new Error(
        `UAPKI INIT failed: ${parsed.error ?? String(parsed.errorCode)}`,
      );
    }
  }

  async process(jsonRequest: string): Promise<UapkiResponse> {
    if (!this.engine) {
      throw new Error("NativeAdapter not initialized");
    }
    const resultJson = await this.engine.process(jsonRequest);
    return JSON.parse(resultJson) as UapkiResponse;
  }

  writeFile(path: string, data: Uint8Array): Promise<void> {
    const file = new File(`file://${path}`);
    file.write(data);
    return Promise.resolve();
  }

  deleteFile(path: string): Promise<void> {
    try {
      const file = new File(`file://${path}`);
      if (file.exists) {
        file.delete();
      }
    } catch {
      // best effort
    }
    return Promise.resolve();
  }

  async destroy(): Promise<void> {
    if (this.engine) {
      await this.engine.process(JSON.stringify({ method: "DEINIT" }));
      this.engine = null;
    }
  }
}

/**
 * Build an async HTTP handler that the native C++ engine calls for OCSP,
 * TSP, and CRL requests. Uses the standard fetch() API.
 *
 * The C++ side invokes this callback on the JS thread (via CallInvoker)
 * while blocking a ThreadPool thread with promise->await().get().
 * When fetch() resolves, the C++ Promise resolves and unblocks the thread.
 *
 * JSON protocol matches the web worker's proxy envelope:
 *   C++ sends:  {"method":"GET"|"POST","url":"...","contentType":"...","bodyBase64":"..."}
 *   JS returns: {"status":200,"bodyBase64":"..."}
 */
function createHttpHandler(corsProxyUrl: string) {
  return async (jsonRequest: string): Promise<string> => {
    try {
      const req = JSON.parse(jsonRequest) as {
        method: string;
        url: string;
        contentType?: string;
        bodyBase64?: string;
      };

      const proxyBody: { url: string; contentType?: string; body?: string } = {
        url: req.url,
      };
      if (req.contentType !== undefined) {
        proxyBody.contentType = req.contentType;
      }
      if (req.bodyBase64 !== undefined) {
        proxyBody.body = req.bodyBase64;
      }

      const response = await fetch(corsProxyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(proxyBody),
      });

      if (!response.ok) {
        return JSON.stringify({ status: response.status, bodyBase64: "" });
      }

      const raw: unknown = await response.json();
      const payload = unwrapProxyResponse(raw);
      return JSON.stringify({
        status: payload.status,
        bodyBase64: payload.bodyBase64 ?? "",
      });
    } catch {
      return JSON.stringify({ status: 0, bodyBase64: "" });
    }
  };
}

export function createNativeAdapter(): UapkiAdapter {
  return new NativeAdapter();
}
