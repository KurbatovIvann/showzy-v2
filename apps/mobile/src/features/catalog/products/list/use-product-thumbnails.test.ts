import { describe, expect, it } from "vitest";

import {
  mergeDownloadUrlPages,
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
