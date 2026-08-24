import { describe, expect, it } from "vitest";

import { normalizeObjectEtag } from "./s3-port.js";

describe("normalizeObjectEtag", () => {
  it("strips S3 quotes and weak-validator prefixes", () => {
    expect(normalizeObjectEtag('"abc"')).toBe("abc");
    expect(normalizeObjectEtag('W/"abc"')).toBe("abc");
    expect(normalizeObjectEtag('w/"abc"')).toBe("abc");
    expect(normalizeObjectEtag("abc")).toBe("abc");
  });
});
