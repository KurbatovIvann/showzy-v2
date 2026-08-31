import { describe, expect, it } from "vitest";

import {
  formChromeEn,
  formChromeUk,
  selectCopy,
  writeErrorsEn,
  writeErrorsUk,
} from "./copy";

function assertKeyParity(
  uk: Record<string, string>,
  en: Record<string, string>,
): void {
  expect(Object.keys(uk).sort()).toEqual(Object.keys(en).sort());
  for (const key of Object.keys(uk)) {
    expect(uk[key]?.length ?? 0).toBeGreaterThan(0);
    expect(en[key]?.length ?? 0).toBeGreaterThan(0);
  }
}

describe("shared copy chrome", () => {
  it("keeps uk/en key parity on write errors", () => {
    assertKeyParity({ ...writeErrorsUk }, { ...writeErrorsEn });
    expect(writeErrorsUk.validation).toBe("Перевірте виділені поля.");
    expect(writeErrorsEn.validation).toBe("Check the highlighted fields.");
    expect(writeErrorsUk.permission).toBe("Немає права змінювати цей запис.");
  });

  it("keeps uk/en key parity on form chrome", () => {
    assertKeyParity({ ...formChromeUk }, { ...formChromeEn });
    expect(formChromeUk.cancel).toBe("Скасувати");
    expect(formChromeEn.cancel).toBe("Cancel");
    expect(formChromeUk.leaveTitle).toBe("Вийти без збереження?");
    expect(formChromeEn.leaveTitle).toBe("Leave without saving?");
    expect(formChromeUk.submitEdit).toBe("Зберегти");
    expect(formChromeEn.changedLabel).toBe("Changed");
  });

  it("selects uk or en from a namespace pair", () => {
    expect(selectCopy("uk", { uk: "Клієнти", en: "Customers" })).toBe(
      "Клієнти",
    );
    expect(selectCopy("en", { uk: "Клієнти", en: "Customers" })).toBe(
      "Customers",
    );
  });
});
