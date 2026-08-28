import { describe, expect, it } from "vitest";

import { customersCopy } from "../../../i18n/customers";
import {
  customersWriteBanner,
  mapCustomersWriteFailure,
} from "./mutation-failure";

describe("mapCustomersWriteFailure", () => {
  it("splits offline and permission from other failures", () => {
    expect(mapCustomersWriteFailure(null)).toBeNull();
    expect(mapCustomersWriteFailure("offline")).toBe("offline");
    expect(mapCustomersWriteFailure("permission")).toBe("permission");
    expect(mapCustomersWriteFailure("not_found")).toBe("error");
    expect(mapCustomersWriteFailure("network")).toBe("error");
  });

  it("does not treat protocol confirmation as a user-facing write failure", () => {
    const copy = customersCopy("uk").mutation;
    expect(mapCustomersWriteFailure("confirmation")).toBeNull();
    expect(
      customersWriteBanner(mapCustomersWriteFailure("confirmation"), copy),
    ).toBeNull();
  });
});

describe("customersWriteBanner", () => {
  it("maps banner keys onto copy", () => {
    const copy = customersCopy("uk").mutation;
    expect(customersWriteBanner(null, copy)).toBeNull();
    expect(customersWriteBanner("offline", copy)).toBe(copy.offline);
    expect(customersWriteBanner("permission", copy)).toBe(copy.permission);
    expect(customersWriteBanner("error", copy)).toBe(copy.error);
  });
});
