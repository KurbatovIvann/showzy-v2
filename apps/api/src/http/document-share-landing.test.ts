import { describe, expect, it } from "vitest";

import {
  SHARE_LANDING_DOWNLOAD_COPY,
  SHARE_LANDING_NOT_FOUND_COPY,
  SHARE_LANDING_REFRESH_COPY,
  SHARE_LANDING_SIGNED_DOWNLOAD_COPY,
  escapeHtml,
  isSafeHttpUrl,
  renderShareLandingHtml,
} from "./document-share-landing.js";

describe("document share landing HTML", () => {
  it("escapes interpolated text so markup cannot run", () => {
    expect(escapeHtml(`<img src=x onerror="alert(1)">`)).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
    );
    const html = renderShareLandingHtml({
      status: "ok",
      type: "payment_invoice",
      documentNumber: `<script>alert(1)</script>`,
      totalGrossMinor: "750",
      currency: "UAH",
      pdfDownloadUrl: `javascript:alert(1)`,
      signedDownloadUrl: `javascript:alert(2)`,
    });
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain(SHARE_LANDING_REFRESH_COPY);
    expect(html).not.toContain("javascript:alert(1)");
    expect(html).not.toContain("javascript:alert(2)");
  });

  it("offers download when the stored URL is http(s) and refresh copy when null", () => {
    const withFile = renderShareLandingHtml({
      status: "ok",
      type: "delivery_note",
      documentNumber: "KA-ВН-000001",
      totalGrossMinor: "250",
      currency: "UAH",
      pdfDownloadUrl: "https://files.example/doc.pdf",
      signedDownloadUrl: null,
    });
    expect(withFile).toContain(SHARE_LANDING_DOWNLOAD_COPY);
    expect(withFile).toContain('href="https://files.example/doc.pdf"');
    expect(withFile).toContain("2.50 UAH");
    expect(withFile).toContain(
      '<a href="https://files.example/doc.pdf" rel="noopener noreferrer" referrerpolicy="no-referrer">',
    );
    expect(withFile).not.toContain(SHARE_LANDING_SIGNED_DOWNLOAD_COPY);

    const withoutFile = renderShareLandingHtml({
      status: "ok",
      type: "payment_invoice",
      documentNumber: "KA-РХ-000001",
      totalGrossMinor: "100",
      currency: "UAH",
      pdfDownloadUrl: null,
      signedDownloadUrl: null,
    });
    expect(withoutFile).toContain(SHARE_LANDING_REFRESH_COPY);
    expect(withoutFile).not.toContain(SHARE_LANDING_DOWNLOAD_COPY);
    expect(withoutFile).not.toContain(SHARE_LANDING_SIGNED_DOWNLOAD_COPY);
  });

  it("adds a signed-file download beside the PDF when the stored ASiC URL is http(s)", () => {
    const both = renderShareLandingHtml({
      status: "ok",
      type: "delivery_note",
      documentNumber: "KA-ВН-000001",
      totalGrossMinor: "250",
      currency: "UAH",
      pdfDownloadUrl: "https://files.example/doc.pdf",
      signedDownloadUrl: "https://files.example/doc.asice",
    });
    expect(both).toContain(SHARE_LANDING_DOWNLOAD_COPY);
    expect(both).toContain(SHARE_LANDING_SIGNED_DOWNLOAD_COPY);
    expect(both).toContain(
      '<a href="https://files.example/doc.pdf" rel="noopener noreferrer" referrerpolicy="no-referrer">',
    );
    expect(both).toContain(
      '<a href="https://files.example/doc.asice" rel="noopener noreferrer" referrerpolicy="no-referrer">',
    );
    expect(both).not.toContain(SHARE_LANDING_REFRESH_COPY);
  });

  it("isolates the page token from the download Referer (noopener noreferrer + no-referrer)", () => {
    const withFile = renderShareLandingHtml({
      status: "ok",
      type: "delivery_note",
      documentNumber: "KA-ВН-000001",
      totalGrossMinor: "250",
      currency: "UAH",
      pdfDownloadUrl: "https://files.example/doc.pdf",
      signedDownloadUrl: "https://files.example/doc.asice",
    });
    expect(withFile).toContain('<meta name="referrer" content="no-referrer">');
    expect(withFile).toContain('rel="noopener noreferrer"');
    expect(withFile).toContain('referrerpolicy="no-referrer"');
    expect(withFile).toContain(
      '<a href="https://files.example/doc.pdf" rel="noopener noreferrer" referrerpolicy="no-referrer">',
    );
    expect(withFile).not.toContain(
      `<a href="https://files.example/doc.pdf">${SHARE_LANDING_DOWNLOAD_COPY}</a>`,
    );

    const notFound = renderShareLandingHtml({ status: "not_found" });
    expect(notFound).toContain('<meta name="referrer" content="no-referrer">');
  });

  it("renders indistinguishable not-found copy", () => {
    const html = renderShareLandingHtml({ status: "not_found" });
    expect(html).toContain(SHARE_LANDING_NOT_FOUND_COPY);
    expect(isSafeHttpUrl("https://ok.example/x")).toBe(true);
    expect(isSafeHttpUrl("http://localhost:3000/x")).toBe(true);
    expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
  });
});
