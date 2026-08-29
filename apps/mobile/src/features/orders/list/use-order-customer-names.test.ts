import { describe, expect, it } from "vitest";

import {
  customerNamesById,
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

describe("customerNamesById", () => {
  it("drops pending and blank names", () => {
    const map = customerNamesById([FIRST, SECOND], ["  Марія  ", undefined]);
    expect(map.get(FIRST)).toBe("Марія");
    expect(map.has(SECOND)).toBe(false);
  });
});
