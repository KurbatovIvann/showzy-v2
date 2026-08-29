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
    expect(uk.subtitle).toBe(
      "Основна інформація для створення профілю бізнесу на Шозі.",
    );
    expect(en.subtitle).toBe(
      "Basic information to create your business profile on Shozee.",
    );
    expect(uk.slugHint).toBe("Адреса вашої публічної сторінки на Шозі.");
    expect(en.slugHint).toBe("The address of your public page on Shozee.");
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
