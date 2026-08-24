import { describe, expect, it } from "vitest";

import { ABANDONED_PENDING_TTL_MS } from "../actions/sweep-abandoned-uploads.contract.js";
import {
  abandonedPendingCutoff,
  pendingAbandonAt,
  SIGNED_PUT_SKEW_MARGIN_MS,
  signedPutWouldOutlivePending,
} from "./pending-abandon.js";
import { SIGNED_URL_TTL_SEC } from "./s3-port.js";

const putTtlMs = SIGNED_URL_TTL_SEC * 1000;

describe("pending abandon cutoff", () => {
  it("is createdAt plus the sweep TTL, inverted by abandonedPendingCutoff", () => {
    const createdAt = new Date("2026-08-24T12:00:00.000Z");
    const abandonAt = pendingAbandonAt(createdAt);
    expect(abandonAt.getTime() - createdAt.getTime()).toBe(
      ABANDONED_PENDING_TTL_MS,
    );
    expect(abandonedPendingCutoff(abandonAt).getTime()).toBe(
      createdAt.getTime(),
    );
    expect(ABANDONED_PENDING_TTL_MS).toBe(4 * putTtlMs);
  });

  it("allows a remint while remaining life is longer than PUT TTL plus skew", () => {
    const now = new Date("2026-08-24T12:00:00.000Z");
    const remainingMs = putTtlMs + SIGNED_PUT_SKEW_MARGIN_MS + 1;
    const createdAt = new Date(
      now.getTime() - (ABANDONED_PENDING_TTL_MS - remainingMs),
    );
    expect(signedPutWouldOutlivePending({ createdAt, now })).toBe(false);
  });

  it("refuses a remint when remaining life equals PUT TTL plus skew", () => {
    const now = new Date("2026-08-24T12:00:00.000Z");
    const remainingMs = putTtlMs + SIGNED_PUT_SKEW_MARGIN_MS;
    const createdAt = new Date(
      now.getTime() - (ABANDONED_PENDING_TTL_MS - remainingMs),
    );
    expect(signedPutWouldOutlivePending({ createdAt, now })).toBe(true);
  });
});
