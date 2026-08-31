import { Directory, File, Paths } from "expo-file-system";
import { NitroModules } from "react-native-nitro-modules";
import { z } from "zod";

import { pkiDebugLog } from "../pki/debug-log.js";
import { unwrapProxyResponse } from "../pki/proxy.js";
import { parseUapkiResponseJson } from "../pki/uapki-json.js";
import type { UapkiEngine } from "../specs/uapki.nitro.js";
import type { UapkiResponse } from "../types.js";
import type { AdapterInitOptions, UapkiAdapter } from "./adapter.js";
import {
  isRepeatInitSelfTestArtifact,
  nativeAdapterHttpPlan,
  withSkipSelfTest,
} from "./http-init.js";

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

    this.engine = NitroModules.createHybridObject<UapkiEngine>("UapkiEngine");

    const uapkiDir = new Directory(Paths.cache, "uapki");
    const certsDir = new Directory(uapkiDir, "certs");
    const crlDir = new Directory(uapkiDir, "crl");

    uapkiDir.create({ idempotent: true });
    certsDir.create({ idempotent: true });
    crlDir.create({ idempotent: true });

    const { corsProxyUrl, initRequestJson: initRequest } =
      nativeAdapterHttpPlan(this.tempDir, options);
    if (corsProxyUrl !== undefined) {
      this.engine.setHttpHandler(createHttpHandler(corsProxyUrl));
    }

    let initResult = await this.engine.process(initRequest);
    let parsed = parseUapkiResponseJson(initResult, "native-adapter INIT");

    if (
      parsed.errorCode !== 0 &&
      (parsed.error ?? "").includes("ALREADY_INITIALIZED")
    ) {
      await this.engine.process(JSON.stringify({ method: "DEINIT" }));
      initResult = await this.engine.process(initRequest);
      parsed = parseUapkiResponseJson(initResult, "native-adapter INIT");
    }

    if (isRepeatInitSelfTestArtifact(parsed)) {
      initResult = await this.engine.process(withSkipSelfTest(initRequest));
      parsed = parseUapkiResponseJson(initResult, "native-adapter INIT");
    }

    if (parsed.errorCode !== 0) {
      throw new Error(
        `UAPKI INIT failed: ${parsed.error ?? String(parsed.errorCode)}${formatSelfTestStatus(parsed)}`,
      );
    }
  }

  async process(jsonRequest: string): Promise<UapkiResponse> {
    if (!this.engine) {
      throw new Error("NativeAdapter not initialized");
    }
    const resultJson = await this.engine.process(jsonRequest);
    return parseUapkiResponseJson(resultJson, "native-adapter");
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
    } catch (error) {
      // best effort
      pkiDebugLog(`native-adapter: delete failed (${path})`, error);
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
 * INIT returns `result.selfTestStatus` (a bitmask of failed uapkic crypto
 * self-tests, see uapkic.h SELF_TEST_*_FAIL) when the power-up self-test
 * fails. Append it to the error so logs show which primitive broke.
 */
function formatSelfTestStatus(response: UapkiResponse): string {
  const status = response.result?.["selfTestStatus"];
  if (typeof status !== "number" || status === 0) {
    return "";
  }
  return ` (selfTestStatus=0x${status.toString(16).padStart(8, "0")})`;
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
const engineHttpRequestSchema = z.looseObject({
  method: z.string(),
  url: z.string(),
  contentType: z.string().optional(),
  bodyBase64: z.string().optional(),
});

function createHttpHandler(corsProxyUrl: string) {
  return async (jsonRequest: string): Promise<string> => {
    try {
      const req = engineHttpRequestSchema.parse(JSON.parse(jsonRequest));

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
    } catch (error) {
      pkiDebugLog("native-adapter: engine HTTP callback failed", error);
      return JSON.stringify({ status: 0, bodyBase64: "" });
    }
  };
}

export function createNativeAdapter(): UapkiAdapter {
  return new NativeAdapter();
}
