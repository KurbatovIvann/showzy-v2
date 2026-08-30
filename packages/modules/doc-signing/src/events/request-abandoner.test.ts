import { describe, expect, it } from "vitest";

import { abandonRequest } from "../actions/abandon-request.js";
import {
  REQUEST_ABANDONER_CONSUMER,
  requestAbandonerCancelled,
  requestAbandonerSubscriptions,
} from "./request-abandoner.js";

describe("docSigning.request-abandoner", () => {
  it("binds documents.cancelled to abandonRequest under one consumer id", () => {
    expect(REQUEST_ABANDONER_CONSUMER).toBe("docSigning.request-abandoner");
    expect(requestAbandonerCancelled.consumer).toBe(REQUEST_ABANDONER_CONSUMER);
    expect(requestAbandonerCancelled.event.name).toBe("documents.cancelled");
    expect(requestAbandonerCancelled.contract).toBe(abandonRequest.contract);
    expect(requestAbandonerSubscriptions).toEqual([requestAbandonerCancelled]);
  });
});
