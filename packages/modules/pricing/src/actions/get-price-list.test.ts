import { describe, expect, it } from "vitest";

import { getPriceListContract } from "./get-price-list.contract.js";

describe("pricing.getPriceList contract", () => {
  it("is a staff client read with pricing:view", () => {
    expect(getPriceListContract.name).toBe("pricing.getPriceList");
    expect(getPriceListContract.principal).toBe("staff");
    expect(getPriceListContract.transport).toBe("client");
    expect(getPriceListContract.risk).toBe("read");
    expect(getPriceListContract.permissions).toEqual(["pricing:view"]);
    expect(getPriceListContract.aiExposure).toBe("exposed");
    expect(getPriceListContract.audit).toBe(false);
    expect(getPriceListContract.idempotent).toBe(false);
    expect(getPriceListContract.emits).toEqual([]);
    expect(getPriceListContract.timeout).toBe(5_000);
  });

  it("accepts a uuid id and rejects missing or malformed ids", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(getPriceListContract.input.parse({ id })).toEqual({ id });
    expect(getPriceListContract.input.safeParse({}).success).toBe(false);
    expect(
      getPriceListContract.input.safeParse({ id: "not-a-uuid" }).success,
    ).toBe(false);
  });
});
