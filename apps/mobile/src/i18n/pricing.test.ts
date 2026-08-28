import { describe, expect, it } from "vitest";

import { detectLocale } from "./locale";
import { pricingCopy } from "./pricing";

describe("pricing copy", () => {
  it("defaults to Ukrainian and picks English only from an en locale", () => {
    expect(pricingCopy(detectLocale()).title).toBe("Прайс-листи");
    expect(pricingCopy(detectLocale("en-US")).title).toBe("Price lists");
  });

  it("keeps uk/en key parity across the namespace", () => {
    const uk = pricingCopy("uk");
    const en = pricingCopy("en");
    expect(Object.keys(uk)).toEqual(Object.keys(en));
    expect(Object.keys(uk.filters)).toEqual(Object.keys(en.filters));
    expect(Object.keys(uk.prices)).toEqual(Object.keys(en.prices));
    expect(Object.keys(uk.empty)).toEqual(Object.keys(en.empty));
    expect(Object.keys(uk.options)).toEqual(Object.keys(en.options));
    expect(Object.keys(uk.confirm)).toEqual(Object.keys(en.confirm));
    expect(Object.keys(uk.toast)).toEqual(Object.keys(en.toast));
    expect(Object.keys(uk.mutation)).toEqual(Object.keys(en.mutation));
    expect(Object.keys(uk.stub)).toEqual(Object.keys(en.stub));
  });

  it("pins canvas price-list copy in uk (name-only search, no assignment line)", () => {
    const uk = pricingCopy("uk");
    expect(uk.searchPlaceholder).toBe("Назва");
    expect(uk.searchLabel).toBe("Пошук прайс-листів");
    expect(uk.createLabel).toBe("Новий прайс-лист");
    expect(uk.filters).toEqual({
      all: "Усі",
      active: "Активні",
      inactive: "Неактивні",
    });
    expect(uk.defaultBadge).toBe("Основний");
    expect(uk.inactiveBadge).toBe("Неактивний");
    expect(uk.empty.catalogTitle).toBe("Прайс-листів ще немає");
    expect(uk.empty.searchTitle).toBe("Нічого не знайдено");
    expect(uk.empty.reset).toBe("Скинути");
    expect(uk.toast.cannotDeactivateDefault).toBe(
      "Спочатку призначте інший основний прайс-лист",
    );
    expect(uk.confirm.deleteTitle).toBe("Видалити прайс-лист?");
    expect(uk.confirm.deleteDescription).toContain("{{name}}");
    expect(uk.confirm.deleteDescription).not.toMatch(/\d+\s+груп/);
    expect(uk.prices.none).toBe("Без окремих цін");
    expect(uk.hint).toContain("призначеного листа");
  });

  it("keeps the interpolation slot in count and confirm templates", () => {
    expect(pricingCopy("uk").prices.one).toContain("{{count}}");
    expect(pricingCopy("en").prices.one).toContain("{{count}}");
    expect(pricingCopy("uk").optionsLabel).toContain("{{name}}");
    expect(pricingCopy("en").confirm.deleteDescription).toContain("{{name}}");
  });
});
