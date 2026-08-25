import { describe, expect, it } from "vitest";

import {
  LIST_PRODUCTS_DEFAULT_LIMIT,
  LIST_PRODUCTS_MAX_LIMIT,
  listProductsContract,
  parseListProductsCursor,
} from "./list-products.contract.js";

describe("catalog.listProducts contract", () => {
  it("is a staff client read with products:view", () => {
    expect(listProductsContract.name).toBe("catalog.listProducts");
    expect(listProductsContract.principal).toBe("staff");
    expect(listProductsContract.transport).toBe("client");
    expect(listProductsContract.risk).toBe("read");
    expect(listProductsContract.permissions).toEqual(["products:view"]);
    expect(listProductsContract.aiExposure).toBe("exposed");
    expect(listProductsContract.audit).toBe(false);
    expect(listProductsContract.emits).toEqual([]);
    expect(listProductsContract.timeout).toBe(5_000);
    expect(LIST_PRODUCTS_DEFAULT_LIMIT).toBe(20);
    expect(LIST_PRODUCTS_MAX_LIMIT).toBe(50);
  });

  it("defaults status to active and rejects a malformed cursor", () => {
    expect(listProductsContract.input.parse({}).status).toBe("active");
    expect(listProductsContract.input.parse({}).limit).toBe(
      LIST_PRODUCTS_DEFAULT_LIMIT,
    );
    expect(
      listProductsContract.input.safeParse({ cursor: "nope" }).success,
    ).toBe(false);
    expect(
      listProductsContract.input.safeParse({
        limit: LIST_PRODUCTS_MAX_LIMIT + 1,
      }).success,
    ).toBe(false);
    expect(
      listProductsContract.input.safeParse({ status: "deleted" }).success,
    ).toBe(false);
    expect(parseListProductsCursor("nope")).toBeUndefined();
  });
});
