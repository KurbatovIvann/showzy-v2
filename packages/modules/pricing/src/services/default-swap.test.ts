import { describe, expect, it } from "vitest";

import { ConflictError } from "@showzy/core/errors";

import {
  DEFAULT_PRICE_LIST_CONFLICT_MESSAGE,
  mapDefaultPriceListUniqueViolation,
  PRICE_LISTS_COMPANY_DEFAULT_UQ,
} from "./default-swap.js";

describe("mapDefaultPriceListUniqueViolation", () => {
  it("maps price_lists_company_default_uq (SQLSTATE 23505) to ConflictError", () => {
    const pg = Object.assign(new Error("duplicate key"), {
      code: "23505",
      constraint: PRICE_LISTS_COMPANY_DEFAULT_UQ,
    });
    const wrapped = new Error("Failed query", { cause: pg });
    const mapped = mapDefaultPriceListUniqueViolation(wrapped);
    expect(mapped).toBeInstanceOf(ConflictError);
    if (mapped instanceof ConflictError) {
      expect(mapped.clientMessage).toBe(DEFAULT_PRICE_LIST_CONFLICT_MESSAGE);
    }
  });

  it("leaves unrelated errors unchanged", () => {
    const other = Object.assign(new Error("duplicate key"), {
      code: "23505",
      constraint: "some_other_uq",
    });
    expect(mapDefaultPriceListUniqueViolation(other)).toBe(other);
    const plain = new Error("boom");
    expect(mapDefaultPriceListUniqueViolation(plain)).toBe(plain);
  });
});
