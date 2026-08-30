import { describe, expect, it } from "vitest";

import { classifyDocumentSharedLoad } from "./document-shared-load";

describe("classifyDocumentSharedLoad", () => {
  it("is not-found for a missing token without fetching", () => {
    expect(
      classifyDocumentSharedLoad({
        token: null,
        clientReady: true,
        authLoading: false,
        status: "pending",
        failureKind: null,
        pdfDownloadUrl: null,
      }),
    ).toEqual({ kind: "not-found" });
  });

  it("loads while auth boots and errors when the client never appears", () => {
    expect(
      classifyDocumentSharedLoad({
        token: "token-once",
        clientReady: false,
        authLoading: true,
        status: "pending",
        failureKind: null,
        pdfDownloadUrl: null,
      }),
    ).toEqual({ kind: "loading" });
    expect(
      classifyDocumentSharedLoad({
        token: "token-once",
        clientReady: false,
        authLoading: false,
        status: "pending",
        failureKind: null,
        pdfDownloadUrl: null,
      }),
    ).toEqual({ kind: "error" });
  });

  it("maps query failures onto offline, not-found, and error", () => {
    expect(
      classifyDocumentSharedLoad({
        token: "token-once",
        clientReady: true,
        authLoading: false,
        status: "error",
        failureKind: "offline",
        pdfDownloadUrl: null,
      }),
    ).toEqual({ kind: "offline" });
    expect(
      classifyDocumentSharedLoad({
        token: "token-once",
        clientReady: true,
        authLoading: false,
        status: "error",
        failureKind: "not_found",
        pdfDownloadUrl: null,
      }),
    ).toEqual({ kind: "not-found" });
    expect(
      classifyDocumentSharedLoad({
        token: "token-once",
        clientReady: true,
        authLoading: false,
        status: "error",
        failureKind: "internal",
        pdfDownloadUrl: null,
      }),
    ).toEqual({ kind: "error" });
  });

  it("exposes a download URL only when it is safe http(s)", () => {
    expect(
      classifyDocumentSharedLoad({
        token: "token-once",
        clientReady: true,
        authLoading: false,
        status: "success",
        failureKind: null,
        pdfDownloadUrl: "https://files.example/doc.pdf",
      }),
    ).toEqual({
      kind: "ready",
      downloadUrl: "https://files.example/doc.pdf",
    });
    expect(
      classifyDocumentSharedLoad({
        token: "token-once",
        clientReady: true,
        authLoading: false,
        status: "success",
        failureKind: null,
        pdfDownloadUrl: null,
      }),
    ).toEqual({ kind: "ready", downloadUrl: null });
    expect(
      classifyDocumentSharedLoad({
        token: "token-once",
        clientReady: true,
        authLoading: false,
        status: "success",
        failureKind: null,
        pdfDownloadUrl: "javascript:alert(1)",
      }),
    ).toEqual({ kind: "ready", downloadUrl: null });
  });
});
