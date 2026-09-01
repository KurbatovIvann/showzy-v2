import { describe, expect, it } from "vitest";

import { GET_COMPANY_ACTION, companyGetQueryKey } from "./get";

describe("companies.get query key (SHO-330)", () => {
  it("is [actionName, companyId, input] and never omits company scope", () => {
    expect(GET_COMPANY_ACTION).toBe("companies.get");
    expect(companyGetQueryKey("company-a")).toEqual([
      "companies.get",
      "company-a",
      {},
    ]);
    expect(companyGetQueryKey("company-a")[1]).not.toBe("null-company");
  });
});
