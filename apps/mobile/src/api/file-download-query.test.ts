import { describe, expect, it } from "vitest";

import { createShowzyQueryClient } from "./query-client";
import {
  downloadUrlStaleTimeMs,
  downloadUrlsStaleTimeMs,
  fileDownloadUrlInput,
  fileDownloadUrlQueryOptions,
  fileDownloadUrlsInput,
  fileDownloadUrlsQueryOptions,
  DOWNLOAD_URL_EXPIRY_MARGIN_MS,
  GET_DOWNLOAD_URL_ACTION,
  GET_DOWNLOAD_URLS_ACTION,
  type FileDownloadClient,
} from "./file-download-query";
import { contractQueryKey } from "./query-options";

const NOW = Date.parse("2026-08-25T10:00:00.000Z");
const FILE_A = "44444444-4444-4444-8444-444444444444";
const FILE_B = "55555555-5555-4555-8555-555555555555";

function unusedDownloadUrl(): never {
  throw new TypeError("getDownloadUrl should not run");
}

function unusedDownloadUrls(): never {
  throw new TypeError("getDownloadUrls should not run");
}

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

describe("fileDownloadUrlInput", () => {
  it("omits rendition so non-catalog callers keep original-object signing", () => {
    expect(fileDownloadUrlInput({ fileId: FILE_A })).toEqual({
      fileId: FILE_A,
    });
    expect(fileDownloadUrlInput({ fileId: FILE_A })).not.toHaveProperty(
      "rendition",
    );
  });

  it("includes a named rendition when catalog asks for one", () => {
    expect(fileDownloadUrlInput({ fileId: FILE_A, rendition: "hero" })).toEqual(
      { fileId: FILE_A, rendition: "hero" },
    );
  });
});

describe("fileDownloadUrlQueryOptions", () => {
  it("keys by action, company selector, and fileId input", () => {
    const options = fileDownloadUrlQueryOptions({
      client: null,
      companyId: "company-a",
      fileId: FILE_A,
      getActiveCompany: () => "company-a",
    });
    expect(options.queryKey).toEqual(
      contractQueryKey(GET_DOWNLOAD_URL_ACTION, "company-a", {
        fileId: FILE_A,
      }),
    );
  });

  it("puts rendition on the query input so thumb and hero caches stay distinct", () => {
    const thumb = fileDownloadUrlQueryOptions({
      client: null,
      companyId: "company-a",
      fileId: FILE_A,
      rendition: "thumb",
      getActiveCompany: () => "company-a",
    });
    const hero = fileDownloadUrlQueryOptions({
      client: null,
      companyId: "company-a",
      fileId: FILE_A,
      rendition: "hero",
      getActiveCompany: () => "company-a",
    });
    expect(thumb.queryKey).toEqual(
      contractQueryKey(GET_DOWNLOAD_URL_ACTION, "company-a", {
        fileId: FILE_A,
        rendition: "thumb",
      }),
    );
    expect(hero.queryKey).not.toEqual(thumb.queryKey);
  });

  it("passes rendition into getDownloadUrl", async () => {
    const seen: unknown[] = [];
    const client: FileDownloadClient = {
      client: {
        files: {
          getDownloadUrl: (input) => {
            seen.push(input);
            return Promise.resolve({
              fileId: FILE_A,
              downloadUrl: "https://example.test/hero",
              expiresAt: new Date(NOW + 15 * 60_000).toISOString(),
            });
          },
          getDownloadUrls: unusedDownloadUrls,
        },
      },
    };
    const queryClient = createShowzyQueryClient({ retryDelay: () => 0 });
    await queryClient.fetchQuery({
      ...fileDownloadUrlQueryOptions({
        client,
        companyId: "company-a",
        fileId: FILE_A,
        rendition: "hero",
        getActiveCompany: () => "company-a",
      }),
      retry: false,
    });
    expect(seen).toEqual([{ fileId: FILE_A, rendition: "hero" }]);
    queryClient.clear();
  });

  it("stays disabled without a client or a company selector", () => {
    expect(
      fileDownloadUrlQueryOptions({
        client: null,
        companyId: "company-a",
        fileId: FILE_A,
        getActiveCompany: () => "company-a",
      }).enabled,
    ).toBe(false);
    expect(
      fileDownloadUrlQueryOptions({
        client: null,
        companyId: null,
        fileId: FILE_A,
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
              fileId: FILE_A,
              downloadUrl: "https://example.test/later",
              expiresAt: later,
            },
            {
              fileId: FILE_B,
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

describe("fileDownloadUrlsInput", () => {
  it("omits rendition for non-catalog callers", () => {
    expect(fileDownloadUrlsInput({ fileIds: [FILE_A, FILE_B] })).toEqual({
      fileIds: [FILE_A, FILE_B],
    });
  });

  it("applies one rendition to the whole batch", () => {
    expect(
      fileDownloadUrlsInput({
        fileIds: [FILE_A, FILE_B],
        rendition: "thumb",
      }),
    ).toEqual({ fileIds: [FILE_A, FILE_B], rendition: "thumb" });
  });
});

describe("fileDownloadUrlsQueryOptions", () => {
  const fileIds = [FILE_A, FILE_B] as const;

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

  it("puts rendition on the query input so named sizes do not share a cache entry", () => {
    const options = fileDownloadUrlsQueryOptions({
      client: null,
      companyId: "company-a",
      fileIds,
      rendition: "card",
      getActiveCompany: () => "company-a",
    });
    expect(options.queryKey).toEqual(
      contractQueryKey(GET_DOWNLOAD_URLS_ACTION, "company-a", {
        fileIds: [...fileIds],
        rendition: "card",
      }),
    );
  });

  it("passes rendition into getDownloadUrls", async () => {
    const seen: unknown[] = [];
    const client: FileDownloadClient = {
      client: {
        files: {
          getDownloadUrl: unusedDownloadUrl,
          getDownloadUrls: (input) => {
            seen.push(input);
            return Promise.resolve({ files: [] });
          },
        },
      },
    };
    const queryClient = createShowzyQueryClient({ retryDelay: () => 0 });
    await queryClient.fetchQuery({
      ...fileDownloadUrlsQueryOptions({
        client,
        companyId: "company-a",
        fileIds,
        rendition: "thumb",
        getActiveCompany: () => "company-a",
      }),
      retry: false,
    });
    expect(seen).toEqual([{ fileIds: [...fileIds], rendition: "thumb" }]);
    queryClient.clear();
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
