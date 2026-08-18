import { describe, expect, it } from "vitest";

import { CoreInvariantError } from "../../errors/index.js";
import { uuidv7 } from "./uuidv7.js";

const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("uuidv7", () => {
  it("produces RFC 9562 v7 ids (version and variant bits)", () => {
    const id = uuidv7(Date.now());
    expect(id).toMatch(UUID_V7_PATTERN);
  });

  it("encodes the timestamp in the leading 48 bits", () => {
    const timestampMs = 0x0123_4567_89ab;
    const id = uuidv7(timestampMs);
    expect(id.startsWith("01234567-89ab-")).toBe(true);
  });

  it("sorts lexicographically by timestamp", () => {
    const base = Date.now();
    const ids = [base, base + 1, base + 1000, base + 60_000].map((ts) =>
      uuidv7(ts),
    );
    expect([...ids].sort()).toEqual(ids);
  });

  it("stays unique within one millisecond (random tail)", () => {
    const timestampMs = Date.now();
    const ids = new Set(
      Array.from({ length: 1000 }, () => uuidv7(timestampMs)),
    );
    expect(ids.size).toBe(1000);
  });

  it.each([-1, 2 ** 48, 1.5, Number.NaN])(
    "rejects the out-of-range timestamp %s",
    (timestampMs) => {
      expect(() => uuidv7(timestampMs)).toThrow(CoreInvariantError);
    },
  );
});
