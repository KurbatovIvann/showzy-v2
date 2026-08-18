import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { canonicalJson, canonicalJsonSha256 } from "./canonical-json.js";

describe("canonicalJson — RFC 8785 JCS serialization", () => {
  it("serializes null", () => {
    expect(canonicalJson(null)).toBe("null");
  });

  it("serializes booleans", () => {
    expect(canonicalJson(true)).toBe("true");
    expect(canonicalJson(false)).toBe("false");
  });

  it("serializes integers", () => {
    expect(canonicalJson(0)).toBe("0");
    expect(canonicalJson(42)).toBe("42");
    expect(canonicalJson(-17)).toBe("-17");
  });

  it("serializes negative zero as zero (JCS §3.2.2.3)", () => {
    expect(canonicalJson(-0)).toBe("0");
  });

  it("serializes floating point numbers using ES toString", () => {
    expect(canonicalJson(1.5)).toBe("1.5");
    expect(canonicalJson(1e20)).toBe("100000000000000000000");
    expect(canonicalJson(1e21)).toBe("1e+21");
  });

  it("rejects NaN and Infinity", () => {
    expect(() => canonicalJson(NaN as never)).toThrow(TypeError);
    expect(() => canonicalJson(Infinity as never)).toThrow(TypeError);
    expect(() => canonicalJson(-Infinity as never)).toThrow(TypeError);
  });

  it("serializes strings with JSON escaping", () => {
    expect(canonicalJson("hello")).toBe('"hello"');
    expect(canonicalJson('a"b')).toBe('"a\\"b"');
    expect(canonicalJson("a\nb")).toBe('"a\\nb"');
  });

  it("serializes empty arrays and objects", () => {
    expect(canonicalJson([])).toBe("[]");
    expect(canonicalJson({})).toBe("{}");
  });

  it("serializes arrays preserving element order", () => {
    expect(canonicalJson([3, 1, 2])).toBe("[3,1,2]");
    expect(canonicalJson(["b", "a"])).toBe('["b","a"]');
  });

  it("sorts object keys lexicographically (JCS §3.2.3)", () => {
    expect(canonicalJson({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
    expect(canonicalJson({ z: true, a: false, m: null })).toBe(
      '{"a":false,"m":null,"z":true}',
    );
  });

  it("handles nested structures with deterministic output", () => {
    const input = {
      items: [{ id: 2 }, { id: 1 }],
      meta: { z: "last", a: "first" },
    };
    expect(canonicalJson(input)).toBe(
      '{"items":[{"id":2},{"id":1}],"meta":{"a":"first","z":"last"}}',
    );
  });

  it("produces identical output regardless of original key insertion order", () => {
    const a = { x: 1, a: 2, m: 3 };
    const b: Record<string, number> = {};
    b.m = 3;
    b.a = 2;
    b.x = 1;
    expect(canonicalJson(a)).toBe(canonicalJson(b));
  });

  it("handles unicode keys sorted by UTF-16 code units", () => {
    const input = { "\u00e9": 1, a: 2, "\u00c9": 3 };
    const result = canonicalJson(input);
    // UTF-16: 'a' = 0x0061, 'É' = 0x00C9, 'é' = 0x00E9 → sorted a < É < é.
    expect(result).toBe('{"a":2,"\u00c9":3,"\u00e9":1}');
  });
});

describe("canonicalJsonSha256", () => {
  it("returns a 64-character lowercase hex string", () => {
    const hash = canonicalJsonSha256({ orderId: "abc" });
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for identical values", () => {
    const a = canonicalJsonSha256({ b: 2, a: 1 });
    const b = canonicalJsonSha256({ a: 1, b: 2 });
    expect(a).toBe(b);
  });

  it("matches a known SHA-256 for an empty object", () => {
    const expected = createHash("sha256").update("{}", "utf8").digest("hex");
    expect(canonicalJsonSha256({})).toBe(expected);
  });

  it("differs for different inputs", () => {
    expect(canonicalJsonSha256({ a: 1 })).not.toBe(
      canonicalJsonSha256({ a: 2 }),
    );
  });
});
