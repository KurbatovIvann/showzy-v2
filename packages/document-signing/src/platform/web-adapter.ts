import { uint8ToBase64 } from "../pki/encoding.js";
import { parseUapkiResponseValue } from "../pki/uapki-json.js";
import type { UapkiResponse } from "../types.js";
import type { AdapterInitOptions, UapkiAdapter } from "./adapter.js";
import type { WorkerCommand, WorkerResponse } from "./worker/types.js";

type PendingRequest = {
  resolve: (value: UapkiResponse) => void;
  reject: (reason: Error) => void;
};

/**
 * Web platform adapter that runs UAPKI in a dedicated Web Worker via WASM.
 * All `process()` calls are serialized through the worker's message channel.
 */
export class WebAdapter implements UapkiAdapter {
  readonly tempDir = "";
  private worker: Worker | null = null;
  private pending = new Map<number, PendingRequest>();
  private nextId = 1;

  async initialize(options: AdapterInitOptions): Promise<void> {
    if (this.worker) {
      throw new Error("WebAdapter already initialized");
    }

    const worker = new Worker(
      new URL("./worker/uapki-worker.ts", import.meta.url),
      { type: "module" },
    );
    this.worker = worker;

    await new Promise<void>((resolve) => {
      const onReady = (event: MessageEvent<WorkerResponse>) => {
        if (event.data.type === "ready") {
          worker.removeEventListener("message", onReady);
          resolve();
        }
      };
      worker.addEventListener("message", onReady);
    });

    this.worker.addEventListener("message", this.handleMessage);

    const initCmd: Extract<WorkerCommand, { type: "init" }> = {
      type: "init",
      corsProxyUrl: options.corsProxyUrl ?? "",
    };
    if (options.wasmLocateFile) {
      initCmd.wasmLocateFile = options.wasmLocateFile("");
    }
    const initResult = await this.send(initCmd);

    if (initResult.errorCode !== 0) {
      throw new Error(
        `UAPKI INIT failed: ${initResult.error ?? String(initResult.errorCode)}`,
      );
    }
  }

  async process(jsonRequest: string): Promise<UapkiResponse> {
    return this.send({ type: "process", jsonRequest });
  }

  async writeFile(path: string, data: Uint8Array): Promise<void> {
    const dataBase64 = uint8ToBase64(data);
    await this.send({ type: "writeFile", path, dataBase64 });
  }

  async deleteFile(path: string): Promise<void> {
    await this.send({ type: "deleteFile", path });
  }

  async destroy(): Promise<void> {
    if (this.worker) {
      try {
        await this.send({ type: "deinit" });
      } catch {
        // best effort
      }
      this.worker.removeEventListener("message", this.handleMessage);
      this.worker.terminate();
      this.worker = null;
    }
    for (const [, req] of this.pending) {
      req.reject(new Error("Worker terminated"));
    }
    this.pending.clear();
  }

  private send(cmd: WorkerCommand): Promise<UapkiResponse> {
    const worker = this.worker;
    if (!worker) {
      return Promise.reject(new Error("Worker not initialized"));
    }

    const id = this.nextId++;
    return new Promise<UapkiResponse>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      worker.postMessage({ id, cmd });
    });
  }

  private handleMessage = (event: MessageEvent<WorkerResponse>): void => {
    const msg = event.data;
    if (msg.type === "ready") return;

    const pending = this.pending.get(msg.id);
    if (!pending) return;
    this.pending.delete(msg.id);

    if (msg.type === "result") {
      // The worker forwards raw UAPKI JSON; validate the envelope here so a
      // malformed engine response is a typed failure (SHO-282).
      try {
        pending.resolve(parseUapkiResponseValue(msg.data, "web-adapter"));
      } catch (error) {
        pending.reject(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
      return;
    }
    pending.reject(new Error(msg.message));
  };
}

export function createWebAdapter(): UapkiAdapter {
  return new WebAdapter();
}
