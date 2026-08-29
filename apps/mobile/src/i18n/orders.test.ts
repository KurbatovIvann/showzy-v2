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
  });

  it("pins the canvas orders-list copy in uk without search or payment", () => {
    const uk = ordersCopy("uk");
    expect(uk.title).toBe("Замовлення");
    expect(uk.createLabel).toBe("Нове замовлення");
    expect(uk.filterTitle).toBe("Фільтри");
    expect(uk.filterStatus).toBe("Статус замовлення");
    expect(uk.filterReset).toBe("Скинути");
    expect(uk.filterApply).toBe("Показати");
    expect(uk.statuses).toEqual({
      new: "Новий",
      confirmed: "Підтверджено",
      canceled: "Скасовано",
    });
    expect(uk.groups).toEqual({
      inProgress: "В роботі",
      completed: "Завершені",
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
    expect(uk.empty.reset).toBe("Скинути фільтри");
    expect(Object.keys(uk.statuses)).not.toContain("in_progress");
    expect(JSON.stringify(uk)).not.toContain("Оплачен");
    expect(JSON.stringify(uk)).not.toContain("Пошук");
  });

  it("pins the order-detail copy in uk without number, payment, or extra statuses", () => {
    const uk = ordersCopy("uk");
    const en = ordersCopy("en");
    expect(uk.detail.title).toBe("Замовлення");
    expect(uk.detail.notFoundTitle).toBe("Замовлення не знайдено");
    expect(uk.detail.customerTitle).toBe("Клієнт");
    expect(uk.detail.linesTitle).toBe("Позиції");
    expect(uk.detail.commentTitle).toBe("Коментар");
    expect(uk.detail.dueLabel).toBe("До сплати");
    expect(uk.detail.confirmLabel).toBe("Підтвердити");
    expect(uk.detail.cancelOrder).toBe("Скасувати замовлення");
    expect(uk.detail.actionsTitle).toBe("Швидкі дії");
    expect(uk.detail.offlineTitle.includes("\u02BC")).toBe(true);
    expect(uk.detail.errorDescription.includes("\u02BC")).toBe(true);
    expect(uk.detail.mutationOffline.includes("\u02BC")).toBe(true);
    expect(uk.detail.offlineTitle.includes("\u2019")).toBe(false);
    expect(en.detail.confirmLabel).toBe("Confirm");
    expect(en.detail.dueLabel).toBe("Due");
    expect(JSON.stringify(uk.detail)).not.toContain("SHZ-");
    expect(JSON.stringify(uk.detail)).not.toContain("#");
    expect(JSON.stringify(uk.detail)).not.toContain("Оплачен");
    expect(JSON.stringify(uk.detail)).not.toContain("Нова Пошта");
    expect(JSON.stringify(uk.detail)).not.toContain("Історія");
    expect(JSON.stringify(uk.detail)).not.toContain("Редагувати");
  });

  it("keeps interpolation slots in both locales", () => {
    expect(ordersCopy("uk").groupCount).toContain("{{title}}");
    expect(ordersCopy("uk").groupCount).toContain("{{count}}");
    expect(ordersCopy("en").groupCount).toContain("{{count}}");
    expect(ordersCopy("uk").filterActiveLabel).toContain("{{count}}");
    expect(ordersCopy("uk").items.one).toContain("{{count}}");
  });
});
