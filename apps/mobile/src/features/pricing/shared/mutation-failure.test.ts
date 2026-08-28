import { describe, expect, it } from "vitest";

import { pricingCopy } from "../../../i18n/pricing";
import { mapPricingWriteFailure, pricingWriteBanner } from "./mutation-failure";

describe("mapPricingWriteFailure", () => {
  it("splits offline and permission from other failures", () => {
    expect(mapPricingWriteFailure(null)).toBeNull();
    expect(mapPricingWriteFailure("offline")).toBe("offline");
    expect(mapPricingWriteFailure("permission")).toBe("permission");
    expect(mapPricingWriteFailure("not_found")).toBe("error");
    expect(mapPricingWriteFailure("network")).toBe("error");
  });

  it("does not treat protocol confirmation as a user-facing write failure", () => {
    const copy = pricingCopy("uk").mutation;
    expect(mapPricingWriteFailure("confirmation")).toBeNull();
    expect(
      pricingWriteBanner(mapPricingWriteFailure("confirmation"), copy),
    ).toBeNull();
  });
});

describe("pricingWriteBanner", () => {
  it("maps banner keys onto copy", () => {
    const copy = pricingCopy("uk").mutation;
    expect(pricingWriteBanner(null, copy)).toBeNull();
    expect(pricingWriteBanner("offline", copy)).toBe(copy.offline);
    expect(pricingWriteBanner("permission", copy)).toBe(copy.permission);
    expect(pricingWriteBanner("error", copy)).toBe(copy.error);
  });
});
