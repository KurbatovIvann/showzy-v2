import { describe, expect, it } from "vitest";

import { contractQueryKey } from "../../../../api/query-options";
import {
  fileDownloadUrlsQueryOptions,
  GET_DOWNLOAD_URLS_ACTION,
} from "../../../../api/file-download-query";
import {
  failedPrimaryImageFileIds,
  mergeDownloadUrlPages,
  PRODUCT_LIST_RENDITION,
  productListDownloadInput,
  resolveProductThumbnail,
  uniquePrimaryImageFileIds,
} from "./use-product-thumbnails";

function item(primaryImageFileId: string | null): {
  readonly primaryImageFileId: string | null;
} {
  return { primaryImageFileId };
}

describe("uniquePrimaryImageFileIds", () => {
  it("skips nulls and duplicates, keeping first-seen order", () => {
    const shared = "44444444-4444-4444-8444-444444444444";
    const other = "55555555-5555-4555-8555-555555555555";
    expect(
      uniquePrimaryImageFileIds([
        item(null),
        item(shared),
        item(other),
        item(shared),
        item(null),
      ]),
    ).toEqual([shared, other]);
  });
});

describe("productListDownloadInput", () => {
  it("batches unique primary image ids onto the thumb rendition (SHO-244)", () => {
    const shared = "44444444-4444-4444-8444-444444444444";
    const other = "55555555-5555-4555-8555-555555555555";
    const fileIds = uniquePrimaryImageFileIds([
      item(null),
      item(shared),
      item(other),
      item(shared),
    ]);
    expect(PRODUCT_LIST_RENDITION).toBe("thumb");
    expect(productListDownloadInput(fileIds)).toEqual({
      fileIds: [shared, other],
      rendition: "thumb",
    });
    const options = fileDownloadUrlsQueryOptions({
      client: null,
      companyId: "company-a",
      getActiveCompany: () => "company-a",
      ...productListDownloadInput(fileIds),
    });
    expect(options.queryKey).toEqual(
      contractQueryKey(GET_DOWNLOAD_URLS_ACTION, "company-a", {
        fileIds: [shared, other],
        rendition: "thumb",
      }),
    );
  });
});

describe("mergeDownloadUrlPages", () => {
  it("ignores pending pages and last write wins for a repeated fileId", () => {
    const first = "44444444-4444-4444-8444-444444444444";
    const second = "55555555-5555-4555-8555-555555555555";
    const merged = mergeDownloadUrlPages([
      undefined,
      {
        files: [
          { fileId: first, downloadUrl: "https://example.test/a" },
          { fileId: second, downloadUrl: "https://example.test/b" },
        ],
      },
      {
        files: [{ fileId: first, downloadUrl: "https://example.test/a2" }],
      },
    ]);
    expect(merged.get(first)).toBe("https://example.test/a2");
    expect(merged.get(second)).toBe("https://example.test/b");
    expect(merged.get("missing")).toBeUndefined();
  });
});

describe("failedPrimaryImageFileIds", () => {
  it("collects ids only from pages whose download query failed", () => {
    const first = "44444444-4444-4444-8444-444444444444";
    const second = "55555555-5555-4555-8555-555555555555";
    expect([
      ...failedPrimaryImageFileIds(
        [{ items: [item(first)] }, { items: [item(second), item(null)] }],
        [false, true],
      ),
    ]).toEqual([second]);
  });
});

describe("resolveProductThumbnail", () => {
  it("maps a download-query error to failed, not success with an empty URL", () => {
    const fileId = "44444444-4444-4444-8444-444444444444";
    expect(
      resolveProductThumbnail({
        fileId,
        url: undefined,
        downloadFailed: true,
      }),
    ).toEqual({ kind: "failed" });
    expect(
      resolveProductThumbnail({
        fileId,
        url: undefined,
        downloadFailed: false,
      }),
    ).toEqual({ kind: "empty" });
    expect(
      resolveProductThumbnail({
        fileId,
        url: "https://example.test/a",
        downloadFailed: true,
      }),
    ).toEqual({ kind: "ready", url: "https://example.test/a" });
    expect(
      resolveProductThumbnail({
        fileId: null,
        url: undefined,
        downloadFailed: true,
      }),
    ).toEqual({ kind: "empty" });
  });
});
