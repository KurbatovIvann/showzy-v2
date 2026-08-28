import { describe, expect, it } from "vitest";

import { customerIdFromParam } from "./customer-id";

const CUSTOMER_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";

describe("customerIdFromParam", () => {
  it("accepts a UUID string and rejects empty, array-empty, and non-UUID values", () => {
    expect(customerIdFromParam(CUSTOMER_ID)).toBe(CUSTOMER_ID);
    expect(customerIdFromParam([CUSTOMER_ID, "extra"])).toBe(CUSTOMER_ID);
    expect(customerIdFromParam(undefined)).toBeNull();
    expect(customerIdFromParam("")).toBeNull();
    expect(customerIdFromParam("not-a-uuid")).toBeNull();
    expect(customerIdFromParam(["", CUSTOMER_ID])).toBeNull();
  });
});
