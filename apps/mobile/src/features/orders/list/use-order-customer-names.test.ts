import { describe, expect, it } from "vitest";

import {
  customerNameHydrationById,
  uniqueCustomerIds,
} from "./use-order-customer-names";

function item(customerId: string | null): {
  readonly customerId: string | null;
} {
  return { customerId };
}

const FIRST = "11111111-1111-4111-8111-111111111111";
const SECOND = "22222222-2222-4222-8222-222222222222";

describe("uniqueCustomerIds", () => {
  it("skips nulls and duplicates, keeping first-seen order", () => {
    expect(
      uniqueCustomerIds([
        item(null),
        item(FIRST),
        item(SECOND),
        item(FIRST),
        item(null),
      ]),
    ).toEqual([FIRST, SECOND]);
  });
});

describe("customerNameHydrationById", () => {
  it("keeps pending distinct from missing and ready", () => {
    const map = customerNameHydrationById(
      [FIRST, SECOND],
      [
        {
          name: "  Марія  ",
          status: "success",
          notFound: false,
        },
        {
          name: undefined,
          status: "pending",
          notFound: false,
        },
      ],
    );
    expect(map.get(FIRST)).toEqual({ kind: "ready", name: "Марія" });
    expect(map.get(SECOND)).toEqual({ kind: "pending" });
  });

  it("maps settled NOT_FOUND to missing, not other failures", () => {
    const permission = "33333333-3333-4333-8333-333333333333";
    const map = customerNameHydrationById(
      [FIRST, permission],
      [
        { name: undefined, status: "error", notFound: true },
        { name: undefined, status: "error", notFound: false },
      ],
    );
    expect(map.get(FIRST)).toEqual({ kind: "missing" });
    expect(map.get(permission)).toEqual({ kind: "pending" });
  });
});
