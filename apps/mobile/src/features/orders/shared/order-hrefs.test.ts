import { describe, expect, it } from "vitest";

import { orderCreateHref, orderDetailHref } from "./order-hrefs";

const ORDER_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";

describe("order hrefs", () => {
  it("keeps create and detail on the orders prefix", () => {
    expect(orderCreateHref()).toBe("/orders/new");
    expect(orderDetailHref(ORDER_ID)).toBe(`/orders/${ORDER_ID}`);
  });
});
