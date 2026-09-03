import { describe, expect, it } from "vitest";

import { detectLocale } from "./locale";
import { orderGroupCountLabel, ordersCopy } from "./orders";

describe("orders copy", () => {
  it("defaults to Ukrainian and picks English only from an en locale", () => {
    expect(detectLocale()).toBe("uk");
    expect(ordersCopy("uk").title).toBe("Замовлення");
    expect(ordersCopy("en").title).toBe("Orders");
    expect(ordersCopy("uk").createLabel).toBe("+ Нове");
    expect(ordersCopy("uk").filterAll).toBe("Усі");
    expect(ordersCopy("uk").emptySelection).toBe("Оберіть елемент");
    expect(ordersCopy("uk").groups.active).toBe("Активні");
    expect(ordersCopy("uk").groups.closed).toBe("Закриті");
    expect(ordersCopy("uk").statuses.in_progress).toBe("В роботі");
    expect(ordersCopy("uk").statuses.done).toBe("Виконано");
    expect(ordersCopy("uk").detail.confirmLabel).toBe("Підтвердити");
    expect(ordersCopy("uk").detail.startLabel).toBe("В роботу");
    expect(ordersCopy("uk").detail.completeLabel).toBe("Виконано");
    expect(ordersCopy("uk").detail.cancelOrder).toBe("Скасувати");
    expect(ordersCopy("uk").detail.completeLabel).not.toBe("Завершено");
  });

  it("never titles a list group В роботі or Завершені", () => {
    expect(ordersCopy("uk").groups.active).not.toBe("В роботі");
    expect(ordersCopy("uk").groups.closed).not.toBe("Завершені");
    expect(orderGroupCountLabel(ordersCopy("uk"), "active", 2)).toBe(
      "Активні · 2",
    );
    expect(orderGroupCountLabel(ordersCopy("uk"), "closed", 1)).toBe(
      "Закриті · 1",
    );
  });
});
