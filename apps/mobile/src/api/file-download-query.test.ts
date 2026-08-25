import { describe, expect, it } from "vitest";

import {
  downloadUrlStaleTimeMs,
  fileDownloadUrlQueryOptions,
  DOWNLOAD_URL_EXPIRY_MARGIN_MS,
  GET_DOWNLOAD_URL_ACTION,
} from "./file-download-query";
import { contractQueryKey } from "./query-options";

const NOW = Date.parse("2026-08-25T10:00:00.000Z");

describe("downloadUrlStaleTimeMs", () => {
  it("is immediately stale without data or with an unparsable expiry", () => {
    expect(downloadUrlStaleTimeMs(undefined, NOW)).toBe(0);
    expect(downloadUrlStaleTimeMs({ expiresAt: "not-a-date" }, NOW)).toBe(0);
  });

  it("refetches a margin before the signed URL expires", () => {
    const expiresAt = new Date(NOW + 5 * 60_000).toISOString();
    expect(downloadUrlStaleTimeMs({ expiresAt }, NOW)).toBe(
      5 * 60_000 - DOWNLOAD_URL_EXPIRY_MARGIN_MS,
    );
  });

  it("never returns a negative stale time for an expired URL", () => {
    const expiresAt = new Date(NOW - 1_000).toISOString();
    expect(downloadUrlStaleTimeMs({ expiresAt }, NOW)).toBe(0);
  });
});

describe("fileDownloadUrlQueryOptions", () => {
  const fileId = "44444444-4444-4444-8444-444444444444";

  it("keys by action, company selector, and fileId input", () => {
    const options = fileDownloadUrlQueryOptions({
      client: null,
      companyId: "company-a",
      fileId,
      getActiveCompany: () => "company-a",
    });
    expect(options.queryKey).toEqual(
      contractQueryKey(GET_DOWNLOAD_URL_ACTION, "company-a", { fileId }),
    );
  });

  it("stays disabled without a client or a company selector", () => {
    expect(
      fileDownloadUrlQueryOptions({
        client: null,
        companyId: "company-a",
        fileId,
        getActiveCompany: () => "company-a",
      }).enabled,
    ).toBe(false);
    expect(
      fileDownloadUrlQueryOptions({
        client: null,
        companyId: null,
        fileId,
        getActiveCompany: () => null,
      }).enabled,
    ).toBe(false);
  });
});
