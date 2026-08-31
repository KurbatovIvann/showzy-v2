import { describe, expect, it } from "vitest";

import {
  base64ToUint8,
  base64ToUint8Chunked,
  hexToBytes,
  leU32,
  uint8ToBase64,
  uint8ToBase64Chunked,
} from "./encoding.js";

function pseudoRandomBytes(length: number): Uint8Array {
  // Deterministic LCG so failures reproduce; covers every byte value.
  const bytes = new Uint8Array(length);
  let state = 0x12345678;
  for (let i = 0; i < length; i++) {
    state = (state * 1664525 + 1013904223) >>> 0;
    bytes[i] = state & 0xff;
  }
  return bytes;
}

/** Native memcmp — vitest's deep `toEqual` on multi-MiB arrays is O(minutes) on slow CI runners. */
function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return Buffer.from(a.buffer, a.byteOffset, a.byteLength).equals(
    Buffer.from(b.buffer, b.byteOffset, b.byteLength),
  );
}

describe("base64 encoding (SHO-282 hot path)", () => {
  it("round-trips a multi-MiB buffer through the Buffer fast path", () => {
    const bytes = pseudoRandomBytes(3 * 1024 * 1024 + 7);
    const b64 = uint8ToBase64(bytes);
    expect(b64).toBe(Buffer.from(bytes).toString("base64"));
    expect(sameBytes(base64ToUint8(b64), bytes)).toBe(true);
  });

  it("round-trips a multi-MiB buffer through the chunked fallback path", () => {
    const bytes = pseudoRandomBytes(2 * 1024 * 1024 + 3);
    const b64 = uint8ToBase64Chunked(bytes);
    expect(b64).toBe(Buffer.from(bytes).toString("base64"));
    expect(sameBytes(base64ToUint8Chunked(b64), bytes)).toBe(true);
  });

  it("fast and fallback paths agree on edge sizes", () => {
    for (const length of [0, 1, 2, 3, 0x7fff, 0x8000, 0x8001]) {
      const bytes = pseudoRandomBytes(length);
      expect(uint8ToBase64Chunked(bytes)).toBe(uint8ToBase64(bytes));
      expect(base64ToUint8Chunked(uint8ToBase64(bytes))).toEqual(
        base64ToUint8(uint8ToBase64(bytes)),
      );
    }
  });

  it("encodes a subarray view without leaking surrounding bytes", () => {
    const backing = pseudoRandomBytes(64);
    const view = backing.subarray(10, 42);
    expect(uint8ToBase64(view)).toBe(
      Buffer.from(backing.slice(10, 42)).toString("base64"),
    );
  });
});

describe("hex/leU32 primitives", () => {
  it("parses hex to bytes", () => {
    expect(hexToBytes("00ff10")).toEqual(new Uint8Array([0, 255, 16]));
  });

  it("reads little-endian u32", () => {
    expect(leU32(new Uint8Array([0x78, 0x56, 0x34, 0x12]), 0)).toBe(0x12345678);
  });
});
