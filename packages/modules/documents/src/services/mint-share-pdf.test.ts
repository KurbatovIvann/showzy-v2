import { CoreInvariantError, NotFoundError } from "@showzy/core/errors";
import { describe, expect, it } from "vitest";

import { mintSharePdfDownload } from "./mint-share-pdf.js";

const fileId = "11111111-1111-4111-8111-111111111111";

describe("mintSharePdfDownload", () => {
  it("skips the issuer when no artifact fileId exists", async () => {
    let called = false;
    const minted = await mintSharePdfDownload({
      fileId: null,
      issueShareDownload: async () => {
        called = true;
        return {
          downloadUrl: "https://files.example/doc.pdf",
          expiresAt: "2026-08-29T12:15:00.000Z",
        };
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
      issueShareDownload: async (id) => {
        expect(id).toBe(fileId);
        return {
          downloadUrl: "https://files.example/doc.pdf",
          expiresAt: "2026-08-29T12:15:00.000Z",
        };
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
      issueShareDownload: async () => {
        throw new NotFoundError();
      },
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
        issueShareDownload: async () => {
          throw new CoreInvariantError("object store unbound");
        },
      }),
    ).rejects.toBeInstanceOf(CoreInvariantError);
  });
});
