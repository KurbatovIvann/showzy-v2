import { describe, expect, it } from "vitest";

import { assistantCopy } from "./assistant";
import { writeErrorsEn, writeErrorsUk } from "./copy";
import { detectLocale } from "./locale";
import { panelCopy } from "./panel";

describe("assistant copy", () => {
  it("defaults to Ukrainian and picks English only from an en locale", () => {
    expect(assistantCopy(detectLocale()).sheetTitle).toBe("Шозік");
    expect(assistantCopy(detectLocale("en-US")).sheetTitle).toBe("Shozik");
  });

  it("keeps uk/en key parity across the namespace", () => {
    const uk = assistantCopy("uk");
    const en = assistantCopy("en");
    expect(Object.keys(uk)).toEqual(Object.keys(en));
    expect(Object.keys(uk.errors)).toEqual(Object.keys(en.errors));
  });

  it("pins sheet title Шозік/Shozik and keeps the BottomNav label AI", () => {
    const uk = assistantCopy("uk");
    const en = assistantCopy("en");
    expect(uk.sheetTitle).toBe("Шозік");
    expect(en.sheetTitle).toBe("Shozik");
    expect(panelCopy("uk").tabs.ai).toBe("AI");
    expect(panelCopy("en").tabs.ai).toBe("AI");
  });

  it("overrides network/unavailable/permission with assistant wording", () => {
    const uk = assistantCopy("uk");
    const en = assistantCopy("en");
    expect(en.errors.network).toBe("Could not reach the assistant. Try again.");
    expect(en.errors.unavailable).toBe(
      "The assistant is unavailable. Try again.",
    );
    expect(en.errors.permission).toBe(
      "You do not have permission to use the assistant.",
    );
    expect(en.errors.notConfigured).toBe("The assistant is not configured.");
    expect(en.errors.network).not.toBe(writeErrorsEn.network);
    expect(en.errors.unavailable).not.toBe(writeErrorsEn.unavailable);
    expect(en.errors.permission).not.toBe(writeErrorsEn.permission);
    expect(uk.errors.network).toBe(
      "Не вдалося звʼязатися з асистентом. Спробуйте ще раз.",
    );
    expect(uk.errors.unavailable).toBe(
      "Асистент недоступний. Спробуйте ще раз.",
    );
    expect(uk.errors.permission).toBe("Немає права користуватися асистентом.");
    expect(uk.errors.network).not.toBe(writeErrorsUk.network);
    expect(uk.errors.unavailable).not.toBe(writeErrorsUk.unavailable);
    expect(uk.errors.permission).not.toBe(writeErrorsUk.permission);
    expect(Object.keys(uk.errors)).toEqual(Object.keys(en.errors));
  });
});
