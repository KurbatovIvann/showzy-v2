import { describe, expect, it } from "vitest";

import { detectLocale } from "./locale";
import { onboardingCopy } from "./onboarding";

describe("onboarding copy", () => {
  it("defaults to Ukrainian and picks English only from an en locale", () => {
    expect(onboardingCopy(detectLocale()).title).toBe("Про ваш бізнес");
    expect(onboardingCopy(detectLocale("en-US")).title).toBe(
      "About your business",
    );
  });

  it("keeps uk/en key parity across the namespace", () => {
    const uk = onboardingCopy("uk");
    const en = onboardingCopy("en");
    expect(Object.keys(uk)).toEqual(Object.keys(en));
    expect(Object.keys(uk.errors)).toEqual(Object.keys(en.errors));
  });

  it("pins canvas company-step copy in uk and en", () => {
    const uk = onboardingCopy("uk");
    const en = onboardingCopy("en");
    expect(uk.title).toBe("Про ваш бізнес");
    expect(en.title).toBe("About your business");
    expect(uk.nameLabel).toBe("Назва бізнесу");
    expect(en.nameLabel).toBe("Business name");
    expect(uk.slugLabel).toBe("Публічна адреса");
    expect(en.slugLabel).toBe("Public address");
    expect(uk.slugHint).toBe("Адреса вашої публічної сторінки на Showzy.");
    expect(en.slugHint).toBe("The address of your public page on Showzy.");
    expect(uk.submit).toBe("Створити профіль бізнесу");
    expect(en.submit).toBe("Create business profile");
    expect(uk.submitLoading).toBe("Створюємо…");
    expect(en.submitLoading).toBe("Creating…");
    expect(uk.errors.slugOccupied).toBe("Ця адреса вже зайнята. Оберіть іншу.");
    expect(en.errors.slugOccupied).toBe(
      "This address is already taken. Choose another.",
    );
  });
});
