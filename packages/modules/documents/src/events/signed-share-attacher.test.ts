import { describe, expect, it } from "vitest";

import { attachSignedShare } from "../actions/attach-signed-share.js";
import {
  SIGNED_SHARE_ATTACHER_CONSUMER,
  signedShareAttacherRecorded,
  signedShareAttacherSubscriptions,
} from "./signed-share-attacher.js";

describe("documents.signed-share-attacher", () => {
  it("binds docSigning.recorded to attachSignedShare under one consumer id", () => {
    expect(SIGNED_SHARE_ATTACHER_CONSUMER).toBe(
      "documents.signed-share-attacher",
    );
    expect(signedShareAttacherRecorded.consumer).toBe(
      SIGNED_SHARE_ATTACHER_CONSUMER,
    );
    expect(signedShareAttacherRecorded.event.name).toBe("docSigning.recorded");
    expect(signedShareAttacherRecorded.contract).toBe(
      attachSignedShare.contract,
    );
    expect(signedShareAttacherSubscriptions).toEqual([
      signedShareAttacherRecorded,
    ]);
  });
});
