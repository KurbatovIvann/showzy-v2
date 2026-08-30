import { describe, expect, it, vi } from "vitest";

import { createMutationAttempt } from "@showzy/contract";
import { ORPCError } from "@orpc/client";

import { createContractMutationController } from "../../../api/contract-mutation";
import { submitWithProtocolConfirmation } from "../../../api/protocol-confirm";
import { bindDocumentRequestSignMutate } from "../api/document-request-sign";
import { SIGNING_MIME_TYPE, SIGNING_PURPOSE } from "./signing-limits";
import {
  mapSigningFailure,
  runDocumentSigning,
  SigningDigestMismatchError,
  SigningPasswordError,
  SigningUnavailableError,
  type DocumentSigningPorts,
  type SigningCompleteOutput,
} from "./signing-pipeline";
import type { SigningPhase } from "./signing-session";

const DOCUMENT_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";
const REQUEST_ID = "1f0e2d5c-4a1b-4c3d-9e8f-102938475602";
const FILE_ID = "2f0e2d5c-4a1b-4c3d-9e8f-102938475603";
const PAYLOAD_SHA = "a".repeat(64);
const ASIC_SHA = "b".repeat(64);
const PAYLOAD_URL = "https://files.example.invalid/payload.pdf?token=secret";
const PUT_URL = "https://files.example.invalid/uploads/pending?token=put";
const PASSWORD = "key-password-once";

function payloadBytes(): Uint8Array {
  return new TextEncoder().encode("%PDF-1.4 fixture");
}

function fakePorts(args: {
  readonly failAt?:
    | "start"
    | "download"
    | "inspect"
    | "digest"
    | "sign"
    | "request"
    | "put"
    | "complete";
  readonly digestMismatch?: boolean;
}): {
  readonly ports: DocumentSigningPorts;
  readonly calls: string[];
  readonly completeInputs: Array<{
    readonly requestId: string;
    readonly fileId: string;
  }>;
} {
  const calls: string[] = [];
  const completeInputs: Array<{
    readonly requestId: string;
    readonly fileId: string;
  }> = [];
  const payload = payloadBytes();
  const ports: DocumentSigningPorts = {
    start: () => {
      calls.push("start");
      if (args.failAt === "start") {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      return Promise.resolve({
        requestId: REQUEST_ID,
        payloadSha256: args.digestMismatch ? "c".repeat(64) : PAYLOAD_SHA,
        payloadDownloadUrl: PAYLOAD_URL,
      });
    },
    downloadPayload: (url) => {
      calls.push("download");
      expect(url).toBe(PAYLOAD_URL);
      if (args.failAt === "download") {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      return Promise.resolve(payload);
    },
    sha256Hex: (bytes) => {
      if (bytes.byteLength === payload.byteLength) {
        return Promise.resolve(PAYLOAD_SHA);
      }
      return Promise.resolve(ASIC_SHA);
    },
    inspectKey: () => {
      calls.push("inspect");
      if (args.failAt === "inspect") {
        return Promise.reject(new SigningPasswordError());
      }
      return Promise.resolve({
        certAlgorithm: "1.2.804.2.1.1.1.1.3.1.1",
        certCommonName: "ФОП Тест",
      });
    },
    digestPayload: () => {
      calls.push("digest");
      if (args.failAt === "digest") {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      return Promise.resolve("ZGlnZXN0");
    },
    signManifest: ({ manifest }) => {
      calls.push("sign");
      expect(manifest.byteLength).toBeGreaterThan(0);
      if (args.failAt === "sign") {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      return Promise.resolve(new Uint8Array([0x30, 0x82, 0x01]));
    },
    requestSigningUpload: (input) => {
      calls.push("request");
      expect(input.purpose).toBe(SIGNING_PURPOSE);
      expect(input.mimeType).toBe(SIGNING_MIME_TYPE);
      expect(input.checksumSha256).toBe(ASIC_SHA);
      if (args.failAt === "request") {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      return Promise.resolve({ fileId: FILE_ID });
    },
    getSigningUploadUrl: () => {
      calls.push("getUrl");
      return Promise.resolve({ uploadUrl: PUT_URL });
    },
    putAsic: ({ uploadUrl }) => {
      calls.push("put");
      expect(uploadUrl).toBe(PUT_URL);
      if (args.failAt === "put") {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      return Promise.resolve();
    },
    complete: (input) => {
      calls.push("complete");
      completeInputs.push(input);
      if (args.failAt === "complete") {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      return Promise.resolve({
        requestId: input.requestId,
        fileId: input.fileId,
        documentId: DOCUMENT_ID,
      });
    },
    createAttempt: () => createMutationAttempt(() => crypto.randomUUID()),
  };
  return { ports, calls, completeInputs };
}

describe("runDocumentSigning", () => {
  it("HITL then start → Nitro ports → handshake PUT → complete { requestId, fileId }", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {
      return;
    });
    const requestCalls: string[] = [];
    const requestSign = createContractMutationController<
      { documentId: string },
      { documentId: string }
    >({
      mutate: bindDocumentRequestSignMutate({
        client: {
          documents: {
            requestSign: (_input, options) => {
              const challenge = options.context.confirmationChallengeId;
              if (challenge === undefined) {
                requestCalls.push("submit");
                return Promise.reject(
                  new ORPCError("CONFIRMATION_REQUIRED", {
                    defined: true,
                    status: 409,
                    message: "Confirm.",
                    data: {
                      challenge: {
                        challengeId: "challenge-sign",
                        summary: "Request a qualified electronic signature.",
                        expiresAt: "2026-08-30T00:00:00.000Z",
                      },
                    },
                  }),
                );
              }
              requestCalls.push(challenge);
              return Promise.resolve({ documentId: DOCUMENT_ID });
            },
          },
        },
      }),
    });

    await submitWithProtocolConfirmation({
      submit: () => requestSign.submit({ documentId: DOCUMENT_ID }),
      confirm: (challengeId) => requestSign.confirm(challengeId),
    });
    expect(requestCalls).toEqual(["submit", "challenge-sign"]);

    const { ports, calls, completeInputs } = fakePorts({});
    const phases: SigningPhase[] = [];
    const names: string[] = [];
    const result: SigningCompleteOutput = await runDocumentSigning({
      documentId: DOCUMENT_ID,
      keyBytes: new Uint8Array([0x30, 0x82]),
      password: PASSWORD,
      ports,
      signal: new AbortController().signal,
      onPhase: (phase) => {
        phases.push(phase);
      },
      onCertCommonName: (name) => {
        names.push(name);
      },
    });

    expect(result).toEqual({
      requestId: REQUEST_ID,
      fileId: FILE_ID,
      documentId: DOCUMENT_ID,
    });
    expect(completeInputs).toEqual([
      { requestId: REQUEST_ID, fileId: FILE_ID },
    ]);
    expect(JSON.stringify(completeInputs[0])).not.toContain("bytes");
    expect(JSON.stringify(completeInputs[0])).not.toContain("base64");
    expect(calls).toEqual([
      "start",
      "download",
      "inspect",
      "digest",
      "sign",
      "request",
      "getUrl",
      "put",
      "complete",
    ]);
    expect(phases).toEqual([
      "starting",
      "downloading",
      "digesting",
      "signing",
      "uploading",
      "completing",
    ]);
    expect(names).toEqual(["ФОП Тест"]);
    expect(JSON.stringify(phases)).not.toContain(PAYLOAD_URL);
    expect(JSON.stringify(phases)).not.toContain(PUT_URL);
    expect(JSON.stringify(phases)).not.toContain(PASSWORD);
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("rejects a payload whose SHA-256 does not match the frozen digest", async () => {
    const { ports } = fakePorts({ digestMismatch: true });
    await expect(
      runDocumentSigning({
        documentId: DOCUMENT_ID,
        keyBytes: new Uint8Array([1]),
        password: PASSWORD,
        ports,
        signal: new AbortController().signal,
        onPhase: () => {
          return;
        },
      }),
    ).rejects.toBeInstanceOf(SigningDigestMismatchError);
  });
});

describe("mapSigningFailure", () => {
  it("maps password, native-unavailable, and digest mismatch without reading messages", () => {
    expect(mapSigningFailure(new SigningPasswordError())).toBe("password");
    expect(mapSigningFailure(new SigningUnavailableError())).toBe("native");
    expect(mapSigningFailure(new SigningDigestMismatchError())).toBe(
      "validation",
    );
  });
});
