import { CoreInvariantError, NotFoundError } from "@showzy/core/errors";
import { describe, expect, it } from "vitest";

import { mintShareDownload, mintSharePdfDownload } from "./mint-share-pdf.js";

const fileId = "11111111-1111-4111-8111-111111111111";

describe("mintShareDownload", () => {
  it("skips the issuer when fileId is null", async () => {
    let called = false;
    const minted = await mintShareDownload({
      fileId: null,
      issueShareDownload: () => {
        called = true;
        return Promise.resolve({
          downloadUrl: "https://files.example/doc.asice",
          expiresAt: "2026-08-29T12:15:00.000Z",
        });
      },
    });
    expect(called).toBe(false);
    expect(minted).toEqual({
      downloadUrl: null,
      downloadExpiresAt: null,
    });
  });

  it("persists the issuer URL when the nested call succeeds", async () => {
    const minted = await mintShareDownload({
      fileId,
      issueShareDownload: (id) => {
        expect(id).toBe(fileId);
        return Promise.resolve({
          downloadUrl: "https://files.example/doc.asice",
          expiresAt: "2026-08-29T12:15:00.000Z",
        });
      },
    });
    expect(minted.downloadUrl).toBe("https://files.example/doc.asice");
    expect(minted.downloadExpiresAt?.toISOString()).toBe(
      "2026-08-29T12:15:00.000Z",
    );
  });
});

describe("mintSharePdfDownload", () => {
  it("skips the issuer when no artifact fileId exists", async () => {
    let called = false;
    const minted = await mintSharePdfDownload({
      fileId: null,
      issueShareDownload: () => {
        called = true;
        return Promise.resolve({
          downloadUrl: "https://files.example/doc.pdf",
          expiresAt: "2026-08-29T12:15:00.000Z",
        });
      },
    });
    expect(called).toBe(false);
    expect(minted).toEqual({
      pdfDownloadUrl: null,
      pdfDownloadExpiresAt: null,
    });
  });

  it("persists the issuer URL when the nested call succeeds", async () => {
    const minted = await mintSharePdfDownload({
      fileId,
      issueShareDownload: (id) => {
        expect(id).toBe(fileId);
        return Promise.resolve({
          downloadUrl: "https://files.example/doc.pdf",
          expiresAt: "2026-08-29T12:15:00.000Z",
        });
      },
    });
    expect(minted.pdfDownloadUrl).toBe("https://files.example/doc.pdf");
    expect(minted.pdfDownloadExpiresAt?.toISOString()).toBe(
      "2026-08-29T12:15:00.000Z",
    );
  });

  it("stores nulls when the issuer reports not-found", async () => {
    const minted = await mintSharePdfDownload({
      fileId,
      issueShareDownload: () => Promise.reject(new NotFoundError()),
    });
    expect(minted).toEqual({
      pdfDownloadUrl: null,
      pdfDownloadExpiresAt: null,
    });
  });

  it("propagates non-not-found issuer errors", async () => {
    await expect(
      mintSharePdfDownload({
        fileId,
        issueShareDownload: () =>
          Promise.reject(new CoreInvariantError("object store unbound")),
      }),
    ).rejects.toBeInstanceOf(CoreInvariantError);
  });
});
