import { describe, expect, it } from "vitest";

import { isSafeHttpUrl } from "./is-safe-http-url";

describe("isSafeHttpUrl", () => {
  it("accepts http(s) and rejects other schemes", () => {
    expect(isSafeHttpUrl("https://example.test/d/file.pdf")).toBe(true);
    expect(isSafeHttpUrl("http://example.test/d/file.pdf")).toBe(true);
    expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeHttpUrl("file:///tmp/x")).toBe(false);
    expect(isSafeHttpUrl("not-a-url")).toBe(false);
  });
});
