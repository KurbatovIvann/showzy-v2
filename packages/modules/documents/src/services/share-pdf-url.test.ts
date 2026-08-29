import { describe, expect, it } from "vitest";

import { storedSharePdfDownloadUrl } from "./share-pdf-url.js";

describe("storedSharePdfDownloadUrl", () => {
  const now = new Date("2026-08-29T12:00:00.000Z");

  it("returns the stored URL when the signature is still valid", () => {
    expect(
      storedSharePdfDownloadUrl(
        "https://files.example/doc.pdf",
        new Date("2026-08-29T12:15:00.000Z"),
        now,
      ),
    ).toBe("https://files.example/doc.pdf");
  });

  it("returns null when the signature expired or fields are missing", () => {
    expect(
      storedSharePdfDownloadUrl(
        "https://files.example/doc.pdf",
        new Date("2026-08-29T11:59:00.000Z"),
        now,
      ),
    ).toBeNull();
    expect(
      storedSharePdfDownloadUrl("https://files.example/doc.pdf", null, now),
    ).toBeNull();
    expect(
      storedSharePdfDownloadUrl(
        null,
        new Date("2026-08-29T13:00:00.000Z"),
        now,
      ),
    ).toBeNull();
  });
});
