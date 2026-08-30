import { describe, expect, it } from "vitest";

import { BACKFILL_BATCH_LIMIT } from "../actions/backfill-catalog-renditions.contract.js";
import {
  BACKFILL_CATALOG_RENDITIONS_INTERVAL_MS,
  inspectOffset,
} from "./backfill-catalog-renditions.js";

describe("inspectOffset", () => {
  const pageSize = BACKFILL_BATCH_LIMIT;
  const intervalMs = BACKFILL_CATALOG_RENDITIONS_INTERVAL_MS;

  it("pins the duplicated worker interval at five minutes", () => {
    expect(BACKFILL_CATALOG_RENDITIONS_INTERVAL_MS).toBe(5 * 60 * 1_000);
    expect(pageSize).toBe(20);
  });

  it("pages 0, 1, then wraps to 0", () => {
    const total = pageSize * 2;
    expect(inspectOffset({ total, pageSize, nowMs: 0, intervalMs })).toBe(0);
    expect(
      inspectOffset({
        total,
        pageSize,
        nowMs: intervalMs,
        intervalMs,
      }),
    ).toBe(pageSize);
    expect(
      inspectOffset({
        total,
        pageSize,
        nowMs: 2 * intervalMs,
        intervalMs,
      }),
    ).toBe(0);
  });

  it("keeps a single page at OFFSET 0 and an empty catalog at OFFSET 0", () => {
    expect(
      inspectOffset({
        total: pageSize,
        pageSize,
        nowMs: intervalMs,
        intervalMs,
      }),
    ).toBe(0);
    expect(
      inspectOffset({ total: 0, pageSize, nowMs: intervalMs, intervalMs }),
    ).toBe(0);
  });
});
