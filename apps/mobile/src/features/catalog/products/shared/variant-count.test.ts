import { describe, expect, it } from "vitest";

import { productsCopy } from "../../../../i18n/products";
import { variantCountLabel } from "./variant-count";

const uk = productsCopy("uk").variants;
const en = productsCopy("en").variants;

describe("variantCountLabel", () => {
  it("uses the dedicated zero form (canvas 'Без варіантів')", () => {
    expect(variantCountLabel(0, "uk", uk)).toBe("Без варіантів");
    expect(variantCountLabel(0, "en", en)).toBe("No variants");
  });

  it("applies Ukrainian one/few/many cardinal rules", () => {
    expect(variantCountLabel(1, "uk", uk)).toBe("1 варіант");
    expect(variantCountLabel(2, "uk", uk)).toBe("2 варіанти");
    expect(variantCountLabel(4, "uk", uk)).toBe("4 варіанти");
    expect(variantCountLabel(5, "uk", uk)).toBe("5 варіантів");
    expect(variantCountLabel(11, "uk", uk)).toBe("11 варіантів");
    expect(variantCountLabel(14, "uk", uk)).toBe("14 варіантів");
    expect(variantCountLabel(21, "uk", uk)).toBe("21 варіант");
    expect(variantCountLabel(22, "uk", uk)).toBe("22 варіанти");
    expect(variantCountLabel(112, "uk", uk)).toBe("112 варіантів");
    expect(variantCountLabel(122, "uk", uk)).toBe("122 варіанти");
  });

  it("applies English one/other rules (21 is plural)", () => {
    expect(variantCountLabel(1, "en", en)).toBe("1 variant");
    expect(variantCountLabel(2, "en", en)).toBe("2 variants");
    expect(variantCountLabel(21, "en", en)).toBe("21 variants");
  });
});
