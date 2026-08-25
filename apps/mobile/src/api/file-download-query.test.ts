import { describe, expect, it } from "vitest";

import {
  downloadUrlStaleTimeMs,
  downloadUrlsStaleTimeMs,
  fileDownloadUrlQueryOptions,
  fileDownloadUrlsQueryOptions,
  DOWNLOAD_URL_EXPIRY_MARGIN_MS,
  GET_DOWNLOAD_URL_ACTION,
  GET_DOWNLOAD_URLS_ACTION,
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

describe("downloadUrlsStaleTimeMs", () => {
  it("is immediately stale without data, with an empty batch, or an unparsable expiry", () => {
    expect(downloadUrlsStaleTimeMs(undefined, NOW)).toBe(0);
    expect(downloadUrlsStaleTimeMs({ files: [] }, NOW)).toBe(0);
    expect(
      downloadUrlsStaleTimeMs(
        {
          files: [{ fileId: "a", downloadUrl: "https://x", expiresAt: "bad" }],
        },
        NOW,
      ),
    ).toBe(0);
  });

  it("uses the soonest expiry in the batch", () => {
    const soon = new Date(NOW + 2 * 60_000).toISOString();
    const later = new Date(NOW + 10 * 60_000).toISOString();
    expect(
      downloadUrlsStaleTimeMs(
        {
          files: [
            {
              fileId: "11111111-1111-4111-8111-111111111111",
              downloadUrl: "https://example.test/later",
              expiresAt: later,
            },
            {
              fileId: "22222222-2222-4222-8222-222222222222",
              downloadUrl: "https://example.test/soon",
              expiresAt: soon,
            },
          ],
        },
        NOW,
      ),
    ).toBe(2 * 60_000 - DOWNLOAD_URL_EXPIRY_MARGIN_MS);
  });
});

describe("fileDownloadUrlsQueryOptions", () => {
  const fileIds = [
    "44444444-4444-4444-8444-444444444444",
    "55555555-5555-4555-8555-555555555555",
  ] as const;

  it("keys by action, company selector, and fileIds input", () => {
    const options = fileDownloadUrlsQueryOptions({
      client: null,
      companyId: "company-a",
      fileIds,
      getActiveCompany: () => "company-a",
    });
    expect(options.queryKey).toEqual(
      contractQueryKey(GET_DOWNLOAD_URLS_ACTION, "company-a", {
        fileIds: [...fileIds],
      }),
    );
  });

  it("stays disabled without a client, company selector, or file ids", () => {
    expect(
      fileDownloadUrlsQueryOptions({
        client: null,
        companyId: "company-a",
        fileIds,
        getActiveCompany: () => "company-a",
      }).enabled,
    ).toBe(false);
    expect(
      fileDownloadUrlsQueryOptions({
        client: null,
        companyId: null,
        fileIds,
        getActiveCompany: () => null,
      }).enabled,
    ).toBe(false);
    expect(
      fileDownloadUrlsQueryOptions({
        client: null,
        companyId: "company-a",
        fileIds: [],
        getActiveCompany: () => "company-a",
      }).enabled,
    ).toBe(false);
  });
});
