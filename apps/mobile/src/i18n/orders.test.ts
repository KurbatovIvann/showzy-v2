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
    expect(uk.empty.catalogTitle).toBe("Замовлень ще немає");
    expect(uk.empty.filteredTitle).toBe("Нічого не знайдено");
    expect(uk.empty.reset).toBe("Скинути фільтри");
    expect(Object.keys(uk.statuses)).not.toContain("in_progress");
    expect(JSON.stringify(uk)).not.toContain("Оплачен");
    expect(JSON.stringify(uk)).not.toContain("Пошук");
  });

  it("keeps interpolation slots in both locales", () => {
    expect(ordersCopy("uk").groupCount).toContain("{{title}}");
    expect(ordersCopy("uk").groupCount).toContain("{{count}}");
    expect(ordersCopy("en").groupCount).toContain("{{count}}");
    expect(ordersCopy("uk").filterActiveLabel).toContain("{{count}}");
    expect(ordersCopy("uk").items.one).toContain("{{count}}");
  });
});
