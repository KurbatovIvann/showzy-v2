import { describe, expect, it } from "vitest";

import { postgresError, postgresUniqueConstraint } from "./postgres-unique.js";

describe("postgresError", () => {
  it("reads code and constraint from the error object", () => {
    expect(
      postgresError({
        code: "23505",
        constraint: "orders_company_id_order_number_uq",
      }),
    ).toEqual({
      code: "23505",
      constraint: "orders_company_id_order_number_uq",
    });
  });

  it("walks a wrapped cause chain", () => {
    expect(
      postgresError({
        cause: {
          cause: { code: "23503", constraint: "fk_orders_customer" },
        },
      }),
    ).toEqual({
      code: "23503",
      constraint: "fk_orders_customer",
    });
  });

  it("returns undefined for non-objects and missing codes", () => {
    expect(postgresError(undefined)).toBeUndefined();
    expect(postgresError("nope")).toBeUndefined();
    expect(postgresError({ message: "plain" })).toBeUndefined();
  });
});

describe("postgresUniqueConstraint", () => {
  it("returns the constraint only for SQLSTATE 23505", () => {
    expect(
      postgresUniqueConstraint({
        cause: {
          code: "23505",
          constraint: "orders_company_id_order_number_uq",
        },
      }),
    ).toBe("orders_company_id_order_number_uq");
    expect(
      postgresUniqueConstraint({
        code: "23503",
        constraint: "orders_company_id_order_number_uq",
      }),
    ).toBeUndefined();
    expect(postgresUniqueConstraint(undefined)).toBeUndefined();
  });
});
