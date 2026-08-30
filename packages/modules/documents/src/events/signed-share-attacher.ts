import { defineEventHandler } from "@showzy/core";
import { docSigningRecorded } from "@showzy/doc-signing";

import { attachSignedShare } from "../actions/attach-signed-share.js";

/** Consumer id: camelCase module + kebab name (core CONSUMER_NAME_PATTERN). */
export const SIGNED_SHARE_ATTACHER_CONSUMER = "documents.signed-share-attacher";

export const signedShareAttacherRecorded = defineEventHandler({
  event: docSigningRecorded,
  consumer: SIGNED_SHARE_ATTACHER_CONSUMER,
  action: attachSignedShare,
});

/** Same objects the API composition root and the worker must both register. */
export const signedShareAttacherSubscriptions = [
  signedShareAttacherRecorded,
] as const;
