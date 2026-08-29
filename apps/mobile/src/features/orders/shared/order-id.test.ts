import { describe, expect, it } from "vitest";

import { orderIdFromParam } from "./order-id";

const ORDER_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";

describe("orderIdFromParam", () => {
  it("accepts a UUID string and rejects empty, array-empty, and non-UUID values", () => {
    expect(orderIdFromParam(ORDER_ID)).toBe(ORDER_ID);
    expect(orderIdFromParam([ORDER_ID, "extra"])).toBe(ORDER_ID);
    expect(orderIdFromParam(undefined)).toBeNull();
    expect(orderIdFromParam("")).toBeNull();
    expect(orderIdFromParam("not-a-uuid")).toBeNull();
    expect(orderIdFromParam("new")).toBeNull();
    expect(orderIdFromParam(["", ORDER_ID])).toBeNull();
  });
});
