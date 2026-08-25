import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  OBJECT_HEAD_POLL_MS,
  waitForObjectVisibility,
} from "./object-visibility.js";

describe("waitForObjectVisibility", () => {
  it("polls HeadObject until present", async () => {
    let calls = 0;
    const store = {
      async headObject() {
        calls += 1;
        return calls < 3 ? "missing" : { byteSize: 1 };
      },
    };
    await waitForObjectVisibility(store, "k", "present");
    expect(calls).toBe(3);
  });

  it("polls HeadObject until missing", async () => {
    let calls = 0;
    const store = {
      async headObject() {
        calls += 1;
        return calls < 2 ? { byteSize: 1 } : "missing";
      },
    };
    await waitForObjectVisibility(store, "k", "missing");
    expect(calls).toBe(2);
  });

  it("times out when HeadObject never matches", async () => {
    await expect(
      waitForObjectVisibility(
        { headObject: () => Promise.resolve("missing") },
        "k",
        "present",
        40,
      ),
    ).rejects.toThrow(/timed out waiting for HeadObject present/);
  });

  it("uses a short poll interval, not a fixed visibility sleep", () => {
    const source = readFileSync(
      path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        "object-visibility.ts",
      ),
      "utf8",
    );
    expect(OBJECT_HEAD_POLL_MS).toBe(25);
    expect(source).toContain("headObject");
    expect(source).not.toMatch(
      /setTimeout\([^,]+,\s*(?:[5-9]\d{2}|[1-9]\d{3,})/,
    );
  });
});
