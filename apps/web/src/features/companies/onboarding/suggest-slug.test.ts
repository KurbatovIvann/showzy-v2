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
