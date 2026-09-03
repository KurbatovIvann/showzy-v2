import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

const confirmSource = readFileSync(join(here, "confirm.ts"), "utf8");
const startSource = readFileSync(join(here, "start.ts"), "utf8");
const completeSource = readFileSync(join(here, "complete.ts"), "utf8");
const cancelSource = readFileSync(join(here, "cancel.ts"), "utf8");

function forUpdateSelect(source: string): string {
  const start = source.indexOf(".select(");
  const end = source.indexOf('.for("update")');
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("orders confirm/start/complete/cancel status lock", () => {
  it("selects { id, status } on the FOR UPDATE read", () => {
    for (const source of [
      confirmSource,
      startSource,
      completeSource,
      cancelSource,
    ]) {
      const lockRead = forUpdateSelect(source);
      expect(lockRead).toContain(
        ".select({ id: orders.id, status: orders.status })",
      );
      expect(lockRead.includes(".select()")).toBe(false);
    }
  });
});
