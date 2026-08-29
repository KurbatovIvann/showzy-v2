import { describe, expect, it } from "vitest";

import { documentsCopy } from "../../../i18n/documents";
import {
  documentsWriteBanner,
  mapDocumentsWriteFailure,
} from "./mutation-failure";

describe("mapDocumentsWriteFailure", () => {
  it("splits offline and permission from other failures", () => {
    expect(mapDocumentsWriteFailure(null)).toBeNull();
    expect(mapDocumentsWriteFailure("offline")).toBe("offline");
    expect(mapDocumentsWriteFailure("permission")).toBe("permission");
    expect(mapDocumentsWriteFailure("not_found")).toBe("error");
    expect(mapDocumentsWriteFailure("network")).toBe("error");
  });

  it("does not treat protocol confirmation as a user-facing write failure", () => {
    const copy = documentsCopy("uk").mutation;
    expect(mapDocumentsWriteFailure("confirmation")).toBeNull();
    expect(
      documentsWriteBanner(mapDocumentsWriteFailure("confirmation"), copy),
    ).toBeNull();
  });
});

describe("documentsWriteBanner", () => {
  it("maps banner keys onto copy", () => {
    const copy = documentsCopy("uk").mutation;
    expect(documentsWriteBanner(null, copy)).toBeNull();
    expect(documentsWriteBanner("offline", copy)).toBe(copy.offline);
    expect(documentsWriteBanner("permission", copy)).toBe(copy.permission);
    expect(documentsWriteBanner("error", copy)).toBe(copy.error);
  });
});
