import { describe, expect, it } from "vitest";

import { collectPagedItems } from "./collect-paged";

describe("collectPagedItems", () => {
  it("walks cursors until nextCursor is null", async () => {
    const pages = new Map<string | null, { items: string[]; nextCursor: string | null }>([
      [null, { items: ["a"], nextCursor: "c1" }],
      ["c1", { items: ["b", "c"], nextCursor: null }],
    ]);
    const items = await collectPagedItems((cursor) => {
      const page = pages.get(cursor);
      if (page === undefined) {
        return Promise.reject(new Error("unexpected cursor"));
      }
      return Promise.resolve(page);
    });
    expect(items).toEqual(["a", "b", "c"]);
  });

  it("stops if a cursor repeats", async () => {
    const items = await collectPagedItems(() =>
      Promise.resolve({ items: ["a"], nextCursor: "loop" }),
    );
    expect(items).toEqual(["a", "a"]);
  });
});
