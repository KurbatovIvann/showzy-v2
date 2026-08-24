import { describe, expect, it } from "vitest";

import {
  BULLMQ_PREFIX,
  CLEANUP_INTERVAL_MS,
  IDEMPOTENCY_CLEANUP_JOB_NAME,
  MAINTENANCE_QUEUE_NAME,
} from "./policy.js";

describe("BullMQ job host policy (fnd-T29)", () => {
  it("pins the showzy prefix, one maintenance queue, and 1h cleanup interval", () => {
    expect(BULLMQ_PREFIX).toBe("showzy");
    expect(MAINTENANCE_QUEUE_NAME).toBe("maintenance");
    expect(IDEMPOTENCY_CLEANUP_JOB_NAME).toBe("cleanupExpiredIdempotencyKeys");
    expect(CLEANUP_INTERVAL_MS).toBe(60 * 60 * 1_000);
  });
});
