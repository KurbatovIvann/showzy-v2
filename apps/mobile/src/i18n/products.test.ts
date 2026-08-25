import { describe, expect, it } from "vitest";

import { detectLocale } from "./locale";
import { productsCopy } from "./products";

describe("products copy", () => {
  it("defaults to Ukrainian and picks English only from an en locale", () => {
    expect(productsCopy(detectLocale()).title).toBe("Товари");
    expect(productsCopy(detectLocale("en-GB")).title).toBe("Products");
  });

  it("keeps uk/en key parity across the namespace", () => {
    const uk = productsCopy("uk");
    const en = productsCopy("en");
    expect(Object.keys(uk)).toEqual(Object.keys(en));
    expect(Object.keys(uk.filters)).toEqual(Object.keys(en.filters));
    expect(Object.keys(uk.variants)).toEqual(Object.keys(en.variants));
    expect(Object.keys(uk.empty)).toEqual(Object.keys(en.empty));
    expect(Object.keys(uk.stub)).toEqual(Object.keys(en.stub));
  });

  it("pins the canvas products-list copy in uk", () => {
    const uk = productsCopy("uk");
    expect(uk.searchPlaceholder).toBe("Назва товару");
    expect(uk.searchLabel).toBe("Пошук товарів");
    expect(uk.createLabel).toBe("Новий товар");
    expect(uk.filters).toEqual({
      all: "Усі",
      active: "Активні",
      archived: "Архівні",
    });
    expect(uk.archivedBadge).toBe("Архівний");
    expect(uk.foundCount).toBe("Знайдено · {{count}}");
    expect(uk.empty.offlineTitle).toBe("Немає зʼєднання");
    expect(uk.empty.errorTitle).toBe("Не вдалося завантажити товари");
    expect(uk.empty.retry).toBe("Повторити");
    expect(uk.empty.searchTitle).toBe("Нічого не знайдено");
    expect(uk.empty.reset).toBe("Скинути");
    expect(uk.empty.archivedTitle).toBe("Архів порожній");
    expect(uk.empty.catalogTitle).toBe("Товарів ще немає");
    expect(uk.empty.catalogDescription).toBe(
      "Створіть перший товар вручну або попросіть AI-асистента.",
    );
    expect(uk.empty.activeTitle).toBe("Активних товарів немає");
    expect(uk.empty.showAll).toBe("Показати всі");
  });

  it("keeps the interpolation slot in both found-count templates", () => {
    expect(productsCopy("uk").foundCount).toContain("{{count}}");
    expect(productsCopy("en").foundCount).toContain("{{count}}");
  });
});
