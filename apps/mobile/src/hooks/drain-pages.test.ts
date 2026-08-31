import { describe, expect, it } from "vitest";

import { shouldDrainNextPage } from "./drain-pages";

describe("shouldDrainNextPage", () => {
  it("drains only a successful next page that is not already fetching", () => {
    expect(
      shouldDrainNextPage({
        status: "success",
        hasNextPage: true,
        isFetchingNextPage: false,
      }),
    ).toBe(true);
    expect(
      shouldDrainNextPage({
        status: "success",
        hasNextPage: true,
        isFetchingNextPage: true,
      }),
    ).toBe(false);
    expect(
      shouldDrainNextPage({
        status: "pending",
        hasNextPage: true,
        isFetchingNextPage: false,
      }),
    ).toBe(false);
    expect(
      shouldDrainNextPage({
        status: "error",
        hasNextPage: true,
        isFetchingNextPage: false,
      }),
    ).toBe(false);
  });
});
