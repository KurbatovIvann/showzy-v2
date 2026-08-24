import { describe, expect, it } from "vitest";

import {
  derivePrefixBase,
  pickAvailablePrefix,
  PREFIX_FALLBACK_BASE,
} from "./prefix.js";

describe("derivePrefixBase", () => {
  it("takes initials of up to the first three words", () => {
    expect(derivePrefixBase("Konditerska Anna")).toBe("KA");
    expect(derivePrefixBase("Nova Doba Plus Market")).toBe("NDP");
  });

  it("takes the first two characters of a single word", () => {
    expect(derivePrefixBase("Zavod")).toBe("ZA");
    expect(derivePrefixBase("X")).toBe("X");
  });

  it("keeps digits and folds diacritics", () => {
    expect(derivePrefixBase("7 Wonders")).toBe("7W");
    expect(derivePrefixBase("Świt Café")).toBe("SC");
  });

  it("ignores punctuation between and around words", () => {
    expect(derivePrefixBase("«Tip-Top!» (Kyiv)")).toBe("TTK");
    expect(derivePrefixBase("  Zavod  ")).toBe("ZA");
  });

  it("falls back for punctuation-only and non-Latin names", () => {
    expect(derivePrefixBase("«—»!!!")).toBe(PREFIX_FALLBACK_BASE);
    expect(derivePrefixBase("Кав'ярня Затишок")).toBe(PREFIX_FALLBACK_BASE);
  });

  it("uses Latin words when the name mixes scripts", () => {
    expect(derivePrefixBase("Кафе Mria")).toBe("MR");
  });
});

describe("pickAvailablePrefix", () => {
  it("returns the base when it is free", () => {
    expect(pickAvailablePrefix("KA", new Set())).toBe("KA");
    expect(pickAvailablePrefix("KA", new Set(["KB"]))).toBe("KA");
  });

  it("appends the first free numeric suffix", () => {
    expect(pickAvailablePrefix("KA", new Set(["KA"]))).toBe("KA2");
    expect(pickAvailablePrefix("KA", new Set(["KA", "KA2", "KA3"]))).toBe(
      "KA4",
    );
  });

  it("skips holes deterministically", () => {
    expect(pickAvailablePrefix("KA", new Set(["KA", "KA3"]))).toBe("KA2");
  });

  it("always finds a free candidate within the taken set bound", () => {
    const taken = new Set<string>(["CO"]);
    for (let n = 2; n <= 60; n += 1) {
      taken.add(`CO${String(n)}`);
    }
    const picked = pickAvailablePrefix("CO", taken);
    expect(taken.has(picked)).toBe(false);
    expect(picked).toBe("CO61");
  });
});
