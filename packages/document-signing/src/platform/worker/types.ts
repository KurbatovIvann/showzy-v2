import type { UapkiResponse } from "../../types.js";

export type WorkerCommand =
  | { type: "init"; corsProxyUrl: string; wasmLocateFile?: string }
  | { type: "process"; jsonRequest: string }
  | { type: "writeFile"; path: string; dataBase64: string }
  | { type: "deleteFile"; path: string }
  | { type: "deinit" };

export type WorkerResponse =
  | { type: "ready" }
  | { type: "result"; id: number; data: UapkiResponse }
  | { type: "error"; id: number; message: string };
