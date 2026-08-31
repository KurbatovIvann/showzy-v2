import { ConflictError } from "@showzy/core/errors";
import { describe, expect, it } from "vitest";

import {
  mapOrderNumberUniqueViolation,
  ORDERS_COMPANY_ORDER_NUMBER_UQ,
} from "./order-number.js";

describe("mapOrderNumberUniqueViolation", () => {
  it("maps orders_company_id_order_number_uq (SQLSTATE 23505) to ConflictError", () => {
    const mapped = mapOrderNumberUniqueViolation({
      code: "23505",
      constraint: ORDERS_COMPANY_ORDER_NUMBER_UQ,
    });
    expect(mapped).toBeInstanceOf(ConflictError);
  });

  it("leaves other errors unchanged", () => {
    const other = { code: "23505", constraint: "other_uq" };
    expect(mapOrderNumberUniqueViolation(other)).toBe(other);
    const plain = new Error("nope");
    expect(mapOrderNumberUniqueViolation(plain)).toBe(plain);
  });
});
