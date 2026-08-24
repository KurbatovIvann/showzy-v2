import { describe, expect, it } from "vitest";

import {
  COMPANY_SLUG_MAX,
  nextSlugAfterNameChange,
  sanitizeSlugInput,
  suggestSlug,
} from "./suggest-slug";

describe("suggestSlug", () => {
  it("transliterates a Ukrainian business name", () => {
    expect(suggestSlug("Солодка майстерня")).toBe("solodka-maisternia");
    expect(suggestSlug("Київ")).toBe("kyiv");
    expect(suggestSlug("Єдність")).toBe("iednist");
  });

  it("maps special Ukrainian letters from the canvas table", () => {
    expect(suggestSlug("Ґанок")).toBe("ganok");
    expect(suggestSlug("Щекавиця")).toBe("shchekavytsia");
    expect(suggestSlug("Хліб")).toBe("khlib");
    expect(suggestSlug("Юність")).toBe("iunist");
  });

  it("strips punctuation and collapses separators", () => {
    expect(suggestSlug("Кава, чай & круасани!")).toBe("kava-chai-kruasany");
    expect(suggestSlug("  Studio  101  ")).toBe("studio-101");
  });

  it("returns empty when nothing slug-like remains", () => {
    expect(suggestSlug("!!!")).toBe("");
    expect(suggestSlug("")).toBe("");
  });

  it("caps the suggestion at 48 characters without a trailing hyphen", () => {
    const long = "а".repeat(80);
    const suggested = suggestSlug(long);
    expect(suggested.length).toBeLessThanOrEqual(COMPANY_SLUG_MAX);
    expect(suggested.endsWith("-")).toBe(false);
  });
});

describe("sanitizeSlugInput", () => {
  it("lowercases and drops characters the server slug pattern rejects", () => {
    expect(sanitizeSlugInput("My Cafe!")).toBe("mycafe");
    expect(sanitizeSlugInput("KYIV-CENTRE")).toBe("kyiv-centre");
  });

  it("does not resume suggestion behavior — it only filters what the user typed", () => {
    expect(sanitizeSlugInput("Солодка")).toBe("");
  });
});

describe("nextSlugAfterNameChange", () => {
  it("keeps suggesting until the slug field is touched", () => {
    expect(
      nextSlugAfterNameChange({
        name: "Київ",
        slugTouched: false,
        currentSlug: "old",
      }),
    ).toBe("kyiv");
    expect(
      nextSlugAfterNameChange({
        name: "Київ",
        slugTouched: true,
        currentSlug: "my-cafe",
      }),
    ).toBe("my-cafe");
  });
});
