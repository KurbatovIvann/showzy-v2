import { describe, expect, it } from "vitest";

import { listAllCatalogProducts } from "./catalog-products-query";
import { listAllPriceListEntries } from "./price-list-entries-query";

const LIST_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";
const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";

describe("editor catalog and entry paging", () => {
  it("requests catalog status all and concatenates pages", async () => {
    const statuses: string[] = [];
    const items = await listAllCatalogProducts({
      client: {
        catalog: {
          listProducts: (input) => {
            statuses.push(input.status);
            if (input.cursor === undefined) {
              return Promise.resolve({
                items: [
                  {
                    id: PRODUCT_ID,
                    name: "Торт",
                    basePriceMinor: "100",
                    currency: "UAH",
                    status: "archived",
                    variantCount: 1,
                    primaryImageFileId: null,
                    createdAt: "2026-08-25T00:00:00.000Z",
                    updatedAt: "2026-08-25T00:00:00.000Z",
                  },
                ],
                nextCursor: "c1",
              });
            }
            return Promise.resolve({ items: [], nextCursor: null });
          },
        },
      },
    });
    expect(statuses).toEqual(["all", "all"]);
    expect(items).toHaveLength(1);
    expect(items[0]?.status).toBe("archived");
    expect(items[0]?.variantCount).toBe(1);
  });

  it("loads every price-list entry page", async () => {
    const items = await listAllPriceListEntries(
      {
        client: {
          pricing: {
            listPriceListEntries: (input) => {
              expect(input.priceListId).toBe(LIST_ID);
              if (input.cursor === undefined) {
                return Promise.resolve({
                  items: [
                    {
                      id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
                      priceListId: LIST_ID,
                      productId: PRODUCT_ID,
                      variantId: null,
                      priceMinor: "0",
                      currency: "UAH",
                    },
                  ],
                  nextCursor: "c1",
                });
              }
              return Promise.resolve({ items: [], nextCursor: null });
            },
          },
        },
      },
      LIST_ID,
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.priceMinor).toBe("0");
  });
});
