import { describe, expect, it } from "vitest";

import {
  formatStaffOrderNumber,
  obfuscateSeq,
  toBase36,
} from "./order-number-format.js";

describe("toBase36", () => {
  it("matches v1 fixtures including zero and 36", () => {
    expect(toBase36(0n)).toBe("0");
    expect(toBase36(36n)).toBe("10");
    expect(toBase36(73_868_438n)).toBe("17Z992");
  });
});

describe("obfuscateSeq", () => {
  it("matches v1 (seq * 73856093 + 12345) % 1000000007 then to_base36", () => {
    expect(obfuscateSeq(1n)).toBe("17Z992");
    expect(obfuscateSeq(2n)).toBe("2FY8Z7");
    expect(obfuscateSeq(3n)).toBe("3NX8PC");
    expect(obfuscateSeq(10n)).toBe("C7Q6SB");
    expect(obfuscateSeq(1042n)).toBe("FUEKDR");
  });
});

describe("formatStaffOrderNumber", () => {
  it("joins prefix and the obfuscated token", () => {
    expect(formatStaffOrderNumber("KA", 1n)).toBe("KA-17Z992");
    expect(formatStaffOrderNumber("N4", 1n)).toBe("N4-17Z992");
    expect(formatStaffOrderNumber("N5", 2n)).toBe("N5-2FY8Z7");
  });
});
