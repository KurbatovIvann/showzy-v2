import { describe, expect, it } from "vitest";

import { CoreInvariantError } from "@showzy/core/errors";

import { uahAmountInWords } from "./amount-in-words.js";

describe("uahAmountInWords", () => {
  it("covers zero, 50 kopiyky, thousands, and typical invoice totals", () => {
    expect(uahAmountInWords("0")).toBe("Нуль гривень 00 копійок");
    expect(uahAmountInWords("50")).toBe("Нуль гривень 50 копійок");
    expect(uahAmountInWords("250")).toBe("Дві гривні 50 копійок");
    expect(uahAmountInWords("100")).toBe("Одна гривня 00 копійок");
    expect(uahAmountInWords("200")).toBe("Дві гривні 00 копійок");
    expect(uahAmountInWords("500")).toBe("П'ять гривень 00 копійок");
    expect(uahAmountInWords("2100")).toBe("Двадцять одна гривня 00 копійок");
    expect(uahAmountInWords("100000")).toBe("Одна тисяча гривень 00 копійок");
    expect(uahAmountInWords("123456")).toBe(
      "Одна тисяча двісті тридцять чотири гривні 56 копійок",
    );
    expect(uahAmountInWords("100000000")).toBe(
      "Один мільйон гривень 00 копійок",
    );
  });

  it("uses kopiyka grammatical forms", () => {
    expect(uahAmountInWords("1")).toBe("Нуль гривень 01 копійка");
    expect(uahAmountInWords("2")).toBe("Нуль гривень 02 копійки");
    expect(uahAmountInWords("11")).toBe("Нуль гривень 11 копійок");
    expect(uahAmountInWords("21")).toBe("Нуль гривень 21 копійка");
  });

  it("rejects illegal minor-unit strings", () => {
    expect(() => uahAmountInWords("")).toThrow(CoreInvariantError);
    expect(() => uahAmountInWords("12.5")).toThrow(CoreInvariantError);
    expect(() => uahAmountInWords("-1")).toThrow(CoreInvariantError);
  });
});
