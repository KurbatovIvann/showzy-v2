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
    expect(Object.keys(uk.form)).toEqual(Object.keys(en.form));
    expect(Object.keys(uk.form.errors)).toEqual(Object.keys(en.form.errors));
    expect(Object.keys(uk.detail)).toEqual(Object.keys(en.detail));
    expect(Object.keys(uk.photos)).toEqual(Object.keys(en.photos));
    expect(Object.keys(uk.photos.errors)).toEqual(
      Object.keys(en.photos.errors),
    );
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

  it("pins the product-detail archive/restore copy in uk", () => {
    const uk = productsCopy("uk");
    expect(uk.detail.title).toBe("Товар");
    expect(uk.detail.variantsTitle).toBe("Варіанти");
    expect(uk.detail.archiveProduct).toBe("Архівувати товар");
    expect(uk.detail.restoreProduct).toBe("Повернути з архіву");
    expect(uk.detail.confirmArchiveProductTitle).toBe("Архівувати товар?");
    expect(uk.detail.cancel).toBe("Скасувати");
    expect(uk.detail.confirmArchiveVariantDescription).toContain("{{name}}");
    expect(uk.stub.editTitle).toBe("Редагувати товар");
    expect(uk.stub.photosTitle).toBe("Фото");
    expect(uk.detail.notFoundDescription).toBe(
      "Не вдалося знайти цей товар або він недоступний.",
    );
    expect(productsCopy("en").detail.notFoundDescription).toBe(
      "This product could not be found or is unavailable.",
    );
    expect(uk.detail.photosManageLabel).toBe("Керувати фото");
    expect(uk.photos.title).toBe("Фото");
    expect(uk.photos.addLabel).toBe("Додати фото");
    expect(uk.photos.addCamera).toBe("Камера");
    expect(uk.photos.addLibrary).toBe("Галерея");
    expect(uk.photos.coverLabel).toBe("Обкладинка");
    expect(uk.photos.emptyTitle).toBe("Немає фото");
    expect(uk.photos.errors.too_many).toBe("Забагато фото. Максимум 10.");
    expect(uk.detail.archiveVariantNamed).toContain("{{name}}");
    expect(uk.detail.restoreVariantNamed).toContain("{{name}}");
  });

  it("pins the product-form copy in uk", () => {
    const uk = productsCopy("uk");
    expect(uk.form.detailsTitle).toBe("Деталі");
    expect(uk.form.priceSectionTitle).toBe("Ціна");
    expect(uk.form.nameLabel).toBe("Назва товару");
    expect(uk.form.namePlaceholder).toBe("Наприклад, Торт «Наполеон»");
    expect(uk.form.priceLabel).toBe("Базова ціна");
    expect(uk.form.variantsTitle).toBe("Варіанти");
    expect(uk.form.addVariant).toBe("Додати варіант");
    expect(uk.form.submitCreate).toBe("Створити товар");
    expect(uk.form.submitEdit).toBe("Зберегти");
    expect(uk.form.cancel).toBe("Скасувати");
    expect(uk.form.changedLabel).toBe("змінено");
    expect(uk.form.leaveTitle).toBe("Вийти без збереження?");
    expect(uk.form.variantSheetCustomPrice).toBe("Інша ціна");
    expect(uk.form.variantInheritedPrice).toContain("{{price}}");
    expect(uk.form.errors.priceInvalid).toBe("Перевірте ціну");
    expect(uk.form.permissionCreateDescription).toBe(
      "Немає права створювати товари.",
    );
    expect(productsCopy("en").form.variantInheritedPrice).toContain(
      "{{price}}",
    );
  });
});
