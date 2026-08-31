import { ConflictError, NotFoundError } from "@showzy/core/errors";
import { describe, expect, it } from "vitest";

import { mapOrderCardInsertViolation } from "./upsert-order-card.js";

describe("mapOrderCardInsertViolation", () => {
  it("maps unique-violation 23505 to ConflictError, not NotFoundError", () => {
    const mapped = mapOrderCardInsertViolation({
      cause: {
        code: "23505",
        constraint: "order_cards_order_id_uq",
      },
    });
    expect(mapped).toBeInstanceOf(ConflictError);
    expect(mapped).not.toBeInstanceOf(NotFoundError);
  });

  it("maps FK violation 23503 to NotFoundError", () => {
    expect(
      mapOrderCardInsertViolation({
        code: "23503",
        constraint: "order_cards_orders_company_fk",
      }),
    ).toBeInstanceOf(NotFoundError);
  });

  it("leaves other errors unchanged", () => {
    const other = { code: "23502" };
    expect(mapOrderCardInsertViolation(other)).toBe(other);
    const plain = new Error("nope");
    expect(mapOrderCardInsertViolation(plain)).toBe(plain);
  });
});
