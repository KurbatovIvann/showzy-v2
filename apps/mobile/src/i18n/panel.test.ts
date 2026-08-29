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
    expect(Object.keys(uk.more)).toEqual(Object.keys(en.more));
  });

  it("pins canvas tab labels in uk and en", () => {
    const uk = panelCopy("uk");
    const en = panelCopy("en");
    expect(uk.tabs).toEqual({
      orders: "Замовлення",
      products: "Товари",
      ai: "AI",
      customers: "Клієнти",
      more: "Ще",
    });
    expect(en.tabs).toEqual({
      orders: "Orders",
      products: "Products",
      ai: "AI",
      customers: "Customers",
      more: "More",
    });
    expect(uk.navigation).toBe("Основна навігація");
    expect(en.navigation).toBe("Main navigation");
  });

  it("pins More-tab session copy carried over from the auth stub", () => {
    const uk = panelCopy("uk");
    const en = panelCopy("en");
    expect(uk.more).toEqual({
      session: "Сесія",
      userId: "ID користувача",
      phone: "Телефон",
      email: "Email",
      companySelector: "Активна компанія",
      signOut: "Вийти",
      management: "Керування",
      priceLists: "Прайс-листи",
      priceListsDescription: "Різні ціни для груп клієнтів",
      documents: "Документи",
      documentsDescription: "Рахунки та видаткові накладні",
      documentsDisabledHint: "Незабаром",
      settings: "Налаштування",
      companySettings: "Налаштування компанії",
      companySettingsDescription: "Профіль і юридичні реквізити",
    });
    expect(en.more).toEqual({
      session: "Session",
      userId: "User ID",
      phone: "Phone",
      email: "Email",
      companySelector: "Active company",
      signOut: "Sign Out",
      management: "Management",
      priceLists: "Price lists",
      priceListsDescription: "Different prices for customer groups",
      documents: "Documents",
      documentsDescription: "Invoices and delivery notes",
      documentsDisabledHint: "Coming soon",
      settings: "Settings",
      companySettings: "Company settings",
      companySettingsDescription: "Profile and legal requisites",
    });
    expect(uk.more.documentsDescription).not.toMatch(/акт/i);
    expect(en.more.documentsDescription).not.toMatch(/acts/i);
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
