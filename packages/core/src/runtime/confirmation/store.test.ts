/**
 * In-memory confirmation store — the behavioral contract a Redis
 * `GETDEL` implementation must match (fnd-T20, core.md §7).
 */
import { describe, expect, it } from "vitest";

import { createInMemoryConfirmationStore } from "./store.js";

function fakeClock(startMs = 1_700_000_000_000): {
  now: () => number;
  advance: (ms: number) => void;
} {
  let current = startMs;
  return {
    now: () => current,
    advance: (ms) => {
      current += ms;
    },
  };
}

describe("in-memory confirmation store", () => {
  it("returns the value once and deletes it", async () => {
    const store = createInMemoryConfirmationStore();

    await store.set("confirm:a", "payload", 60_000);
    await expect(store.getAndDelete("confirm:a")).resolves.toBe("payload");
    await expect(store.getAndDelete("confirm:a")).resolves.toBeNull();
  });

  it("returns null for a missing key", async () => {
    const store = createInMemoryConfirmationStore();

    await expect(store.getAndDelete("confirm:missing")).resolves.toBeNull();
  });

  it("treats an expired entry as missing", async () => {
    const clock = fakeClock();
    const store = createInMemoryConfirmationStore({ now: clock.now });

    await store.set("confirm:a", "payload", 5_000);
    clock.advance(5_001);

    await expect(store.getAndDelete("confirm:a")).resolves.toBeNull();
  });

  it("gives the value to exactly one concurrent consumer", async () => {
    const store = createInMemoryConfirmationStore();
    await store.set("confirm:a", "payload", 60_000);

    const [first, second] = await Promise.all([
      store.getAndDelete("confirm:a"),
      store.getAndDelete("confirm:a"),
    ]);

    expect([first, second].filter((value) => value === "payload")).toHaveLength(
      1,
    );
    expect([first, second].filter((value) => value === null)).toHaveLength(1);
  });
});
