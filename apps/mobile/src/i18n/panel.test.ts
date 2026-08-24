import { describe, expect, it } from "vitest";

import { detectLocale } from "./locale";
import { panelCopy } from "./panel";

describe("panel copy", () => {
  it("defaults to Ukrainian and picks English only from an en locale", () => {
    expect(panelCopy(detectLocale()).tabs.orders).toBe("Замовлення");
    expect(panelCopy(detectLocale("en-US")).tabs.orders).toBe("Orders");
  });

  it("keeps uk/en key parity across the namespace", () => {
    const uk = panelCopy("uk");
    const en = panelCopy("en");
    expect(Object.keys(uk)).toEqual(Object.keys(en));
    expect(Object.keys(uk.tabs)).toEqual(Object.keys(en.tabs));
  });

  it("pins canvas tab labels in uk and en", () => {
    const uk = panelCopy("uk");
    const en = panelCopy("en");
    expect(uk.tabs).toEqual({
      orders: "Замовлення",
      products: "Товари",
      ai: "AI",
      customers: "Клієнти",
    });
    expect(en.tabs).toEqual({
      orders: "Orders",
      products: "Products",
      ai: "AI",
      customers: "Customers",
    });
    expect(uk.navigation).toBe("Основна навігація");
    expect(en.navigation).toBe("Main navigation");
  });

  it("pins placeholder copy in uk and en", () => {
    const uk = panelCopy("uk");
    const en = panelCopy("en");
    expect(uk.placeholderTitle).toBe("Модуль у розробці");
    expect(en.placeholderTitle).toBe("Module in development");
    expect(uk.placeholderDescription).toBe("Цей розділ незабаром з’явиться.");
    expect(en.placeholderDescription).toBe("This section is coming soon.");
  });
});
