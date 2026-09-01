import { describe, expect, it } from "vitest";

import { documentsCopy } from "../../../i18n/documents";
import {
  documentsWriteBanner,
  mapDocumentsWriteFailure,
  presentDocumentWritesBanner,
  shareMintFailureBanner,
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

describe("shareMintFailureBanner", () => {
  it("surfaces share-mint failures through the write-banner mapping", () => {
    const mutation = documentsCopy("uk").mutation;
    const fallback = documentsCopy("uk").toast.shareFailed;
    expect(shareMintFailureBanner("network", mutation, fallback)).toBe(
      mutation.error,
    );
    expect(shareMintFailureBanner("offline", mutation, fallback)).toBe(
      mutation.offline,
    );
    expect(shareMintFailureBanner("permission", mutation, fallback)).toBe(
      mutation.permission,
    );
    expect(shareMintFailureBanner("confirmation", mutation, fallback)).toBe(
      fallback,
    );
    expect(shareMintFailureBanner(null, mutation, fallback)).toBe(fallback);
  });

  it("prefers a local toast over share then cancel mutation banners", () => {
    const mutation = documentsCopy("uk").mutation;
    expect(
      presentDocumentWritesBanner({
        localBanner: "local",
        shareFailure: "network",
        cancelFailure: "offline",
        mutationCopy: mutation,
      }),
    ).toBe("local");
    expect(
      presentDocumentWritesBanner({
        localBanner: null,
        shareFailure: "network",
        cancelFailure: "offline",
        mutationCopy: mutation,
      }),
    ).toBe(mutation.error);
    expect(
      presentDocumentWritesBanner({
        localBanner: null,
        shareFailure: null,
        cancelFailure: "offline",
        mutationCopy: mutation,
      }),
    ).toBe(mutation.offline);
  });
});
