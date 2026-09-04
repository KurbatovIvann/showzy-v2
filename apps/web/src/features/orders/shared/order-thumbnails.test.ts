import { describe, expect, it } from "vitest";

import {
  failedPrimaryImageFileIds,
  mergeDownloadUrlPages,
  orderThumbnailView,
  resolveOrderThumbnail,
  retainStringMap,
  retainStringSet,
  uniquePrimaryImageFileIds,
} from "./order-thumbnails";

function item(primaryImageFileId: string | null): {
  readonly primaryImageFileId: string | null;
} {
  return { primaryImageFileId };
}

const FILE_A = "44444444-4444-4444-8444-444444444444";
const FILE_B = "55555555-5555-4555-8555-555555555555";

describe("uniquePrimaryImageFileIds", () => {
  it("skips nulls and duplicates, keeping first-seen order", () => {
    expect(
      uniquePrimaryImageFileIds([
        item(null),
        item(FILE_A),
        item(FILE_B),
        item(FILE_A),
        item(null),
      ]),
    ).toEqual([FILE_A, FILE_B]);
  });
});

describe("mergeDownloadUrlPages", () => {
  it("ignores pending pages and last write wins for a repeated fileId", () => {
    const merged = mergeDownloadUrlPages([
      undefined,
      {
        files: [
          { fileId: FILE_A, downloadUrl: "https://example.test/a" },
          { fileId: FILE_B, downloadUrl: "https://example.test/b" },
        ],
      },
      {
        files: [{ fileId: FILE_A, downloadUrl: "https://example.test/a2" }],
      },
    ]);
    expect(merged.get(FILE_A)).toBe("https://example.test/a2");
    expect(merged.get(FILE_B)).toBe("https://example.test/b");
    expect(merged.get("missing")).toBeUndefined();
  });
});

describe("failedPrimaryImageFileIds", () => {
  it("collects ids only from pages whose download query failed", () => {
    expect([
      ...failedPrimaryImageFileIds(
        [{ items: [item(FILE_A)] }, { items: [item(FILE_B), item(null)] }],
        [false, true],
      ),
    ]).toEqual([FILE_B]);
  });
});

describe("retainStringMap / retainStringSet", () => {
  it("keeps the previous collection when contents match so thumbnail memos can bail", () => {
    const urls = mergeDownloadUrlPages([
      {
        files: [{ fileId: FILE_A, downloadUrl: "https://example.test/a" }],
      },
    ]);
    const sameUrls = mergeDownloadUrlPages([
      {
        files: [{ fileId: FILE_A, downloadUrl: "https://example.test/a" }],
      },
    ]);
    expect(sameUrls).not.toBe(urls);
    expect(retainStringMap(urls, sameUrls)).toBe(urls);
    expect(
      retainStringMap(
        urls,
        mergeDownloadUrlPages([
          {
            files: [{ fileId: FILE_A, downloadUrl: "https://example.test/b" }],
          },
        ]),
      ),
    ).not.toBe(urls);

    const failed = failedPrimaryImageFileIds(
      [{ items: [item(FILE_A)] }],
      [true],
    );
    const sameFailed = failedPrimaryImageFileIds(
      [{ items: [item(FILE_A)] }],
      [true],
    );
    expect(sameFailed).not.toBe(failed);
    expect(retainStringSet(failed, sameFailed)).toBe(failed);
    expect(
      retainStringSet(
        failed,
        failedPrimaryImageFileIds([{ items: [item(FILE_B)] }], [true]),
      ),
    ).not.toBe(failed);
  });
});

describe("resolveOrderThumbnail", () => {
  it("maps a file id to a url request path and null to a placeholder", () => {
    expect(
      resolveOrderThumbnail({
        fileId: FILE_A,
        url: "https://example.test/a",
        downloadFailed: false,
      }),
    ).toEqual({ kind: "ready", url: "https://example.test/a" });
    expect(
      resolveOrderThumbnail({
        fileId: null,
        url: undefined,
        downloadFailed: false,
      }),
    ).toEqual({ kind: "empty" });
    expect(
      orderThumbnailView({
        fileId: null,
        url: "https://example.test/ignored",
        downloadFailed: true,
      }),
    ).toEqual({ fileId: null, url: null, failed: false });
  });

  it("maps a download-query error to failed, not success with an empty URL", () => {
    expect(
      resolveOrderThumbnail({
        fileId: FILE_A,
        url: undefined,
        downloadFailed: true,
      }),
    ).toEqual({ kind: "failed" });
    expect(
      resolveOrderThumbnail({
        fileId: FILE_A,
        url: undefined,
        downloadFailed: false,
      }),
    ).toEqual({ kind: "empty" });
    expect(
      resolveOrderThumbnail({
        fileId: FILE_A,
        url: "https://example.test/a",
        downloadFailed: true,
      }),
    ).toEqual({ kind: "ready", url: "https://example.test/a" });
  });
});
