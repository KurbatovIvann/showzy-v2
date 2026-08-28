import { describe, expect, it } from "vitest";

import {
  bindListPriceListsPage,
  listPriceListsWireInput,
} from "./price-list.queries";

describe("listPriceListsWireInput", () => {
  it("forwards availability and optional name query, and appends the cursor", () => {
    expect(
      listPriceListsWireInput({ availability: "all" }, null),
    ).toEqual({ availability: "all" });
    expect(
      listPriceListsWireInput(
        { availability: "active", query: "опт" },
        "1|aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa|Опт",
      ),
    ).toEqual({
      availability: "active",
      query: "опт",
      cursor: "1|aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa|Опт",
    });
  });
});

describe("bindListPriceListsPage", () => {
  it("calls pricing.listPriceLists with query and availability", async () => {
    const seen: unknown[] = [];
    const fetchPage = bindListPriceListsPage(
      {
        client: {
          pricing: {
            listPriceLists: (input) => {
              seen.push(input);
              return Promise.resolve({ items: [], nextCursor: null });
            },
          },
        },
      },
      { availability: "inactive", query: "vip" },
    );

    await fetchPage(null);
    expect(seen).toEqual([{ availability: "inactive", query: "vip" }]);
  });
});
