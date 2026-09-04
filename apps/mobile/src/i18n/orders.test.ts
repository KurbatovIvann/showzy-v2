import { describe, expect, it } from "vitest";

import { detectLocale } from "./locale";
import { ordersCopy } from "./orders";

describe("orders copy", () => {
  it("defaults to Ukrainian and picks English only from an en locale", () => {
    expect(ordersCopy(detectLocale()).title).toBe("Замовлення");
    expect(ordersCopy(detectLocale("en-GB")).title).toBe("Orders");
  });

  it("keeps uk/en key parity across the namespace", () => {
    const uk = ordersCopy("uk");
    const en = ordersCopy("en");
    expect(Object.keys(uk)).toEqual(Object.keys(en));
    expect(Object.keys(uk.statuses)).toEqual(Object.keys(en.statuses));
    expect(Object.keys(uk.groups)).toEqual(Object.keys(en.groups));
    expect(Object.keys(uk.items)).toEqual(Object.keys(en.items));
    expect(Object.keys(uk.empty)).toEqual(Object.keys(en.empty));
    expect(Object.keys(uk.detail)).toEqual(Object.keys(en.detail));
    expect(Object.keys(uk.create)).toEqual(Object.keys(en.create));
    expect(Object.keys(uk.create.errors)).toEqual(
      Object.keys(en.create.errors),
    );
    expect(Object.keys(uk.create.variants)).toEqual(
      Object.keys(en.create.variants),
    );
  });

  it("pins the canvas orders-list copy in uk with search and without payment", () => {
    const uk = ordersCopy("uk");
    const en = ordersCopy("en");
    expect(uk.title).toBe("Замовлення");
    expect(uk.createLabel).toBe("Нове замовлення");
    expect(uk.searchLabel).toBe("Пошук замовлень");
    expect(uk.searchPlaceholder).toBe("Номер, клієнт або телефон");
    expect(en.searchLabel).toBe("Search orders");
    expect(en.searchPlaceholder).toBe("Number, customer or phone");
    expect(uk.filterTitle).toBe("Фільтри");
    expect(uk.filterStatus).toBe("Статус замовлення");
    expect(uk.filterReset).toBe("Скинути");
    expect(uk.filterApply).toBe("Показати");
    expect(uk.statuses).toEqual({
      new: "Нове",
      confirmed: "Підтверджено",
      in_progress: "В роботі",
      done: "Виконано",
      canceled: "Скасовано",
    });
    expect(en.statuses).toEqual({
      new: "New",
      confirmed: "Confirmed",
      in_progress: "In progress",
      done: "Done",
      canceled: "Canceled",
    });
    expect(uk.groups).toEqual({
      active: "Активні",
      closed: "Закриті",
    });
    expect(en.groups).toEqual({
      active: "Active",
      closed: "Closed",
    });
    expect(uk.missingCustomer).toBe("Клієнт видалений");
    expect(uk.empty.offlineTitle).toBe("Немає зʼєднання");
    expect(uk.empty.errorDescription).toBe(
      "Перевірте зʼєднання та спробуйте ще раз.",
    );
    expect(uk.empty.offlineTitle.includes("\u02BC")).toBe(true);
    expect(uk.empty.errorDescription.includes("\u02BC")).toBe(true);
    expect(uk.empty.offlineTitle.includes("\u2019")).toBe(false);
    expect(uk.empty.errorDescription.includes("\u2019")).toBe(false);
    expect(uk.empty.catalogTitle).toBe("Замовлень ще немає");
    expect(uk.empty.filteredTitle).toBe("Нічого не знайдено");
    expect(uk.empty.filteredDescription).toBe(
      "Спробуйте змінити пошук чи фільтри або скинути їх.",
    );
    expect(en.empty.filteredDescription).toBe(
      "Change the search or filters, or reset them.",
    );
    expect(uk.empty.reset).toBe("Скинути пошук і фільтри");
    expect(Object.keys(uk.statuses)).toContain("in_progress");
    expect(Object.keys(uk.statuses)).toContain("done");
    expect(Object.keys(uk.statuses)).not.toContain("completed");
    expect(Object.keys(uk.statuses)).not.toContain("active");
    expect(Object.keys(uk.statuses)).not.toContain("all");
    expect(Object.keys(uk.groups)).not.toContain("inProgress");
    expect(Object.keys(uk.groups)).not.toContain("completed");
    expect(JSON.stringify(uk)).not.toContain("Оплачен");
  });

  it("pins the order-detail i18n copy in uk without # in strings (header number is formatOrderNumber), payment, or extra statuses", () => {
    const uk = ordersCopy("uk");
    const en = ordersCopy("en");
    expect(uk.detail.title).toBe("Замовлення");
    expect(uk.detail.notFoundTitle).toBe("Замовлення не знайдено");
    expect(uk.detail.customerTitle).toBe("Клієнт");
    expect(uk.detail.linesTitle).toBe("Позиції");
    expect(uk.detail.commentTitle).toBe("Коментар");
    expect(uk.detail.dueLabel).toBe("До сплати");
    expect(uk.detail.confirmLabel).toBe("Підтвердити");
    expect(uk.detail.startLabel).toBe("В роботу");
    expect(uk.detail.completeLabel).toBe("Виконано");
    expect(uk.detail.cancelOrder).toBe("Скасувати замовлення");
    expect(uk.detail.actionsTitle).toBe("Швидкі дії");
    expect(uk.detail.offlineTitle.includes("\u02BC")).toBe(true);
    expect(uk.detail.errorDescription.includes("\u02BC")).toBe(true);
    expect(uk.detail.mutationOffline.includes("\u02BC")).toBe(true);
    expect(uk.detail.offlineTitle.includes("\u2019")).toBe(false);
    expect(en.detail.confirmLabel).toBe("Confirm");
    expect(en.detail.startLabel).toBe("Start");
    expect(en.detail.completeLabel).toBe("Complete");
    expect(en.detail.dueLabel).toBe("Due");
    expect(uk.detail.thumbnailUnavailable).toBe("Фото недоступне");
    expect(en.detail.thumbnailUnavailable).toBe("Photo unavailable");
    expect(JSON.stringify(uk.detail)).not.toContain("SHZ-");
    expect(JSON.stringify(uk.detail)).not.toContain("#");
    expect(JSON.stringify(uk.detail)).not.toContain("Оплачен");
    expect(JSON.stringify(uk.detail)).not.toContain("Нова Пошта");
    expect(JSON.stringify(uk.detail)).not.toContain("Історія");
    expect(JSON.stringify(uk.detail)).not.toContain("Редагувати");
  });

  it("pins create-editor copy without prices, payment, or edit-after-create", () => {
    const uk = ordersCopy("uk");
    const en = ordersCopy("en");
    expect(Object.keys(uk.create)).toEqual(Object.keys(en.create));
    expect(Object.keys(uk.create.errors)).toEqual(
      Object.keys(en.create.errors),
    );
    expect(Object.keys(uk.create.variants)).toEqual(
      Object.keys(en.create.variants),
    );
    expect(uk.create.title).toBe("Нове замовлення");
    expect(uk.create.itemsTitle).toBe("Товари");
    expect(uk.create.addProductsPlaceholder).toBe(
      "Додайте товари до замовлення",
    );
    expect(uk.create.customerPlaceholder).toBe("Оберіть клієнта");
    expect(uk.create.commentLabel).toBe("Для внутрішнього використання");
    expect(uk.create.submitCreate).toBe("Створити");
    expect(uk.create.productSheetDone).toBe("Готово · {{count}}");
    expect(uk.create.variantsBackLabel).toBe("Назад до товарів");
    expect(uk.create.variantsLoading).toBe("Завантажуємо варіанти…");
    expect(uk.create.variantsError).toBe(
      "Не вдалося завантажити варіанти. Спробуйте ще раз.",
    );
    expect(uk.create.variantsSelected).toBe("{{count}} вибрано · {{names}}");
    expect(uk.create.thumbnailUnavailable).toBe("Фото недоступне");
    expect(uk.create.emptyPositions).toBe("Без позицій");
    expect(en.create.emptyPositions).toBe("No items");
    expect(en.create.productSheetDone).toBe("Done · {{count}}");
    expect(en.create.variantsBackLabel).toBe("Back to products");
    expect(en.create.variantsSelected).toBe("{{count}} selected · {{names}}");
    expect(uk.create.leaveTitle).toBe("Вийти без збереження?");
    expect(uk.create.errors.offline.includes("\u02BC")).toBe(true);
    expect(uk.create.errors.network.includes("\u02BC")).toBe(true);
    expect(uk.create.errors.offline.includes("\u2019")).toBe(false);
    expect(uk.create.errors.network.includes("\u2019")).toBe(false);
    expect(en.create.title).toBe("New order");
    expect(en.create.submitCreate).toBe("Create");
    expect(JSON.stringify(uk.create)).not.toContain("Редактор у розробці");
    expect(JSON.stringify(uk.create)).not.toContain("До сплати");
    expect(JSON.stringify(uk.create)).not.toContain("Оплачен");
    expect(JSON.stringify(uk.create)).not.toContain("Нова Пошта");
    expect(JSON.stringify(uk.create)).not.toContain("Редагувати");
    expect(JSON.stringify(uk.create)).not.toContain("basePrice");
  });

  it("keeps interpolation slots in both locales", () => {
    expect(ordersCopy("uk").groupCount).toContain("{{title}}");
    expect(ordersCopy("uk").groupCount).toContain("{{count}}");
    expect(ordersCopy("en").groupCount).toContain("{{count}}");
    expect(ordersCopy("uk").filterActiveLabel).toContain("{{count}}");
    expect(ordersCopy("uk").items.one).toContain("{{count}}");
    expect(ordersCopy("uk").create.addProductsValue).toContain("{{count}}");
    expect(ordersCopy("en").create.addProductsValue).toContain("{{count}}");
    expect(ordersCopy("uk").create.productSheetDone).toContain("{{count}}");
    expect(ordersCopy("en").create.productSheetDone).toContain("{{count}}");
    expect(ordersCopy("uk").create.variantsSelected).toContain("{{count}}");
    expect(ordersCopy("uk").create.variantsSelected).toContain("{{names}}");
    expect(ordersCopy("en").create.variantsSelected).toContain("{{names}}");
    expect(ordersCopy("uk").create.removeLine).toContain("{{name}}");
    expect(ordersCopy("en").create.removeLine).toContain("{{name}}");
  });
});
