import { describe, expect, it } from "vitest";

import { slugifyUk } from "./slug.js";

describe("@showzy/validation/slug", () => {
  it("transliterates Latin and Ukrainian names", () => {
    expect(slugifyUk("VIP")).toBe("vip");
    expect(slugifyUk("Wholesale 2024")).toBe("wholesale-2024");
    expect(slugifyUk("Солодка майстерня")).toBe("solodka-maisternia");
    expect(slugifyUk("Київ")).toBe("kyiv");
    expect(slugifyUk("Київські торти")).toBe("kyivski-torty");
    expect(slugifyUk("Єдність")).toBe("iednist");
    expect(slugifyUk("віп")).toBe("vip");
  });

  it("maps special Ukrainian letters from the official table", () => {
    expect(slugifyUk("Ґанок")).toBe("ganok");
    expect(slugifyUk("Щекавиця")).toBe("shchekavytsia");
    expect(slugifyUk("Хліб")).toBe("khlib");
    expect(slugifyUk("Юність")).toBe("iunist");
  });

  it("strips punctuation and collapses separators", () => {
    expect(slugifyUk("Кава, чай & круасани!")).toBe("kava-chai-kruasany");
    expect(slugifyUk("Кав'ярня Затишок")).toBe("kav-iarnia-zatyshok");
    expect(slugifyUk("  Studio  101  ")).toBe("studio-101");
    expect(slugifyUk("A---B")).toBe("a-b");
  });

  it("returns empty when nothing slug-like remains", () => {
    expect(slugifyUk("!!!")).toBe("");
    expect(slugifyUk("")).toBe("");
    expect(slugifyUk("«—»!!!")).toBe("");
    expect(slugifyUk("...")).toBe("");
  });

  it("caps at max without a trailing hyphen from the cut", () => {
    expect(slugifyUk("а".repeat(80), { max: 48 })).toBe("a".repeat(48));
    expect(slugifyUk("ab-cd", { max: 3 })).toBe("ab");
    expect(slugifyUk("studio-101", { max: 48 })).toBe("studio-101");
  });
});
