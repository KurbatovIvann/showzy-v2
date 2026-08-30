import { describe, expect, it } from "vitest";

import { classifyDocumentSharedLoad } from "./document-shared-load";

const base = {
  token: "token-once",
  clientReady: true,
  authLoading: false,
  status: "success" as const,
  failureKind: null,
  pdfDownloadUrl: null as string | null,
  signedDownloadUrl: null as string | null,
};

describe("classifyDocumentSharedLoad", () => {
  it("is not-found for a missing token without fetching", () => {
    expect(
      classifyDocumentSharedLoad({
        ...base,
        token: null,
        status: "pending",
      }),
    ).toEqual({ kind: "not-found" });
  });

  it("loads while auth boots and errors when the client never appears", () => {
    expect(
      classifyDocumentSharedLoad({
        ...base,
        clientReady: false,
        authLoading: true,
        status: "pending",
      }),
    ).toEqual({ kind: "loading" });
    expect(
      classifyDocumentSharedLoad({
        ...base,
        clientReady: false,
        authLoading: false,
        status: "pending",
      }),
    ).toEqual({ kind: "error" });
  });

  it("maps query failures onto offline, not-found, and error", () => {
    expect(
      classifyDocumentSharedLoad({
        ...base,
        status: "error",
        failureKind: "offline",
      }),
    ).toEqual({ kind: "offline" });
    expect(
      classifyDocumentSharedLoad({
        ...base,
        status: "error",
        failureKind: "not_found",
      }),
    ).toEqual({ kind: "not-found" });
    expect(
      classifyDocumentSharedLoad({
        ...base,
        status: "error",
        failureKind: "internal",
      }),
    ).toEqual({ kind: "error" });
  });

  it("exposes download URLs only when they are safe http(s)", () => {
    expect(
      classifyDocumentSharedLoad({
        ...base,
        pdfDownloadUrl: "https://files.example/doc.pdf",
      }),
    ).toEqual({
      kind: "ready",
      downloadUrl: "https://files.example/doc.pdf",
      signedDownloadUrl: null,
    });
    expect(classifyDocumentSharedLoad(base)).toEqual({
      kind: "ready",
      downloadUrl: null,
      signedDownloadUrl: null,
    });
    expect(
      classifyDocumentSharedLoad({
        ...base,
        pdfDownloadUrl: "javascript:alert(1)",
        signedDownloadUrl: "javascript:alert(2)",
      }),
    ).toEqual({
      kind: "ready",
      downloadUrl: null,
      signedDownloadUrl: null,
    });
    expect(
      classifyDocumentSharedLoad({
        ...base,
        pdfDownloadUrl: "https://files.example/doc.pdf",
        signedDownloadUrl: "https://files.example/doc.asice",
      }),
    ).toEqual({
      kind: "ready",
      downloadUrl: "https://files.example/doc.pdf",
      signedDownloadUrl: "https://files.example/doc.asice",
    });
  });
});
