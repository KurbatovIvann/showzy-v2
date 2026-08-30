import { defineEventHandler } from "@showzy/core";
import { documentsCancelled } from "@showzy/documents";

import { abandonRequest } from "../actions/abandon-request.js";

/** Consumer id: camelCase module + kebab name (core CONSUMER_NAME_PATTERN). */
export const REQUEST_ABANDONER_CONSUMER = "docSigning.request-abandoner";

export const requestAbandonerCancelled = defineEventHandler({
  event: documentsCancelled,
  consumer: REQUEST_ABANDONER_CONSUMER,
  action: abandonRequest,
});

/** Same objects the API composition root and the worker must both register. */
export const requestAbandonerSubscriptions = [
  requestAbandonerCancelled,
] as const;
