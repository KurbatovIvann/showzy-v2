/// <reference lib="webworker" />
import type { UapkiResponse } from "../../types.js";
import type { WorkerCommand, WorkerResponse } from "./types.js";

declare function createUapkiModule(options?: {
  locateFile?: (path: string) => string;
}): Promise<UapkiModule>;

interface UapkiModule {
  ccall: (
    name: string,
    returnType: string,
    argTypes: string[],
    args: unknown[],
  ) => unknown;
  cwrap: (
    name: string,
    returnType: string,
    argTypes: string[],
  ) => (...args: unknown[]) => unknown;
  FS: {
    mkdir: (path: string) => void;
    writeFile: (path: string, data: Uint8Array) => void;
    unlink: (path: string) => void;
  };
  UTF8ToString: (ptr: number) => string;
  stringToUTF8: (str: string, ptr: number, maxLen: number) => void;
  lengthBytesUTF8: (str: string) => number;
  _malloc: (size: number) => number;
  _free: (ptr: number) => void;
}

let wasmModule: UapkiModule | null = null;
let processFunc: ((jsonPtr: number) => number) | null = null;
let jsonFreeFunc: ((ptr: number) => void) | null = null;

function callUapki(request: Record<string, unknown>): UapkiResponse {
  if (!wasmModule || !processFunc || !jsonFreeFunc) {
    throw new Error("WASM module not initialized");
  }

  const jsonStr = JSON.stringify(request);
  const len = wasmModule.lengthBytesUTF8(jsonStr) + 1;
  const ptr = wasmModule._malloc(len);
  wasmModule.stringToUTF8(jsonStr, ptr, len);

  const resultPtr = processFunc(ptr) as number;
  wasmModule._free(ptr);

  if (!resultPtr) {
    throw new Error("UAPKI process() returned null");
  }

  const resultStr = wasmModule.UTF8ToString(resultPtr);
  jsonFreeFunc(resultPtr);

  return JSON.parse(resultStr) as UapkiResponse;
}

async function handleInit(
  cmd: Extract<WorkerCommand, { type: "init" }>,
): Promise<UapkiResponse> {
  const locateFile = cmd.wasmLocateFile
    ? (path: string) => `${cmd.wasmLocateFile}${path}`
    : undefined;

  const scriptUrl = locateFile ? locateFile("uapki.js") : "/uapki/uapki.js";
  importScripts(scriptUrl);

  wasmModule = await createUapkiModule({
    locateFile: locateFile ?? ((path: string) => `/uapki/${path}`),
  });

  processFunc = wasmModule.cwrap("process", "number", ["number"]) as (
    ptr: number,
  ) => number;
  jsonFreeFunc = wasmModule.cwrap("json_free", "void", ["number"]) as (
    ptr: number,
  ) => void;

  const setCorsProxyUrl = wasmModule.cwrap("set_cors_proxy_url", "void", [
    "string",
  ]) as (url: string) => void;
  if (cmd.corsProxyUrl) {
    setCorsProxyUrl(cmd.corsProxyUrl);
  }

  for (const dir of ["/tmp", "/certs", "/crl"]) {
    try {
      wasmModule.FS.mkdir(dir);
    } catch {
      // already exists
    }
  }

  return callUapki({
    method: "INIT",
    parameters: {
      cmProviders: {
        dir: "",
        allowedProviders: [{ lib: "cm-pkcs12" }],
      },
      certCache: { path: "/certs" },
      crlCache: { path: "/crl" },
      offline: false,
    },
  });
}

function handleProcess(
  cmd: Extract<WorkerCommand, { type: "process" }>,
): UapkiResponse {
  const request = JSON.parse(cmd.jsonRequest) as Record<string, unknown>;
  return callUapki(request);
}

function handleWriteFile(
  cmd: Extract<WorkerCommand, { type: "writeFile" }>,
): UapkiResponse {
  if (!wasmModule) throw new Error("WASM not initialized");
  const binary = atob(cmd.dataBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  wasmModule.FS.writeFile(cmd.path, bytes);
  return { errorCode: 0, method: "__writeFile" };
}

function handleDeleteFile(
  cmd: Extract<WorkerCommand, { type: "deleteFile" }>,
): UapkiResponse {
  if (!wasmModule) throw new Error("WASM not initialized");
  try {
    wasmModule.FS.unlink(cmd.path);
  } catch {
    // best effort
  }
  return { errorCode: 0, method: "__deleteFile" };
}

function handleDeinit(): UapkiResponse {
  const result = callUapki({ method: "DEINIT" });
  wasmModule = null;
  processFunc = null;
  jsonFreeFunc = null;
  return result;
}

self.onmessage = async (
  event: MessageEvent<{ id: number; cmd: WorkerCommand }>,
) => {
  const { id, cmd } = event.data;

  try {
    let result: UapkiResponse;

    switch (cmd.type) {
      case "init":
        result = await handleInit(cmd);
        break;
      case "process":
        result = handleProcess(cmd);
        break;
      case "writeFile":
        result = handleWriteFile(cmd);
        break;
      case "deleteFile":
        result = handleDeleteFile(cmd);
        break;
      case "deinit":
        result = handleDeinit();
        break;
      default:
        throw new Error(`Unknown command: ${(cmd as WorkerCommand).type}`);
    }

    const response: WorkerResponse = { type: "result", id, data: result };
    self.postMessage(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const response: WorkerResponse = { type: "error", id, message };
    self.postMessage(response);
  }
};

self.postMessage({ type: "ready" } satisfies WorkerResponse);
