import { describe, expect, it, vi } from "vitest";

import { createShowzyClient } from "../../../api/client";
import { createWebQueryClient } from "../../../api/query-client";
import { StaleCompanyQueryError } from "../../../api/query-options";
import {
  GET_PRODUCT_ACTION,
  LIST_PRODUCTS_ACTION,
  ORDER_PRODUCT_LOOKUP_INPUT,
  catalogGetProductQueryKey,
  catalogListProductsQueryKey,
  catalogListProductsQueryOptions,
} from "./catalog";

const COMPANY_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const COMPANY_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PRODUCT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

describe("catalog lookup query keys (SHO-379)", () => {
  it("is [actionName, companyId, input] and never omits company scope", () => {
    expect(LIST_PRODUCTS_ACTION).toBe("catalog.listProducts");
    expect(GET_PRODUCT_ACTION).toBe("catalog.getProduct");
    expect(catalogListProductsQueryKey("company-a")).toEqual([
      "catalog.listProducts",
      "company-a",
      ORDER_PRODUCT_LOOKUP_INPUT,
    ]);
    expect(catalogListProductsQueryKey("company-a", "  Троянди  ")).toEqual([
      "catalog.listProducts",
      "company-a",
      { ...ORDER_PRODUCT_LOOKUP_INPUT, query: "Троянди" },
    ]);
    expect(catalogListProductsQueryKey("company-a", "   ")).toEqual(
      catalogListProductsQueryKey("company-a"),
    );
    expect(catalogListProductsQueryKey("company-a", "Троянди")).not.toEqual(
      catalogListProductsQueryKey("company-a"),
    );
    expect(catalogGetProductQueryKey("company-a", PRODUCT_ID)).toEqual([
      "catalog.getProduct",
      "company-a",
      { productId: PRODUCT_ID },
    ]);
    expect(catalogListProductsQueryKey("company-a")[1]).not.toBe(
      "null-company",
    );
  });
});

describe("catalogListProductsQueryOptions live selector (SHO-379)", () => {
  it("does not write when live setActiveCompany drifts mid-flight", async () => {
    let release: (() => void) | undefined;
    let fetchStarted = false;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const client = createShowzyClient({
      baseUrl: "http://panel.test",
      initialCompanyId: COMPANY_A,
      fetch: async () => {
        fetchStarted = true;
        await gate;
        return new Response(
          JSON.stringify({
            json: { items: [], nextCursor: null },
          }),
          { headers: { "content-type": "application/json" } },
        );
      },
    });
    const queryClient = createWebQueryClient();
    const options = catalogListProductsQueryOptions({
      client,
      companyId: COMPANY_A,
    });
    const pending = queryClient.fetchQuery(options);
    await vi.waitFor(() => {
      expect(fetchStarted).toBe(true);
    });
    client.setActiveCompany(COMPANY_B);
    release?.();
    await expect(pending).rejects.toBeInstanceOf(StaleCompanyQueryError);
    expect(queryClient.getQueryData(options.queryKey)).toBeUndefined();
    queryClient.clear();
  });
});
