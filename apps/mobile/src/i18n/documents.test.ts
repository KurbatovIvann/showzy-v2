import { describe, expect, it } from "vitest";

import { documentsCopy } from "./documents";
import { detectLocale } from "./locale";

describe("documents copy", () => {
  it("defaults to Ukrainian and picks English only from an en locale", () => {
    expect(documentsCopy(detectLocale()).title).toBe("Документи");
    expect(documentsCopy(detectLocale("en-US")).title).toBe("Documents");
  });

  it("keeps uk/en key parity across the namespace", () => {
    const uk = documentsCopy("uk");
    const en = documentsCopy("en");
    expect(Object.keys(uk)).toEqual(Object.keys(en));
    expect(Object.keys(uk.filters)).toEqual(Object.keys(en.filters));
    expect(Object.keys(uk.types)).toEqual(Object.keys(en.types));
    expect(Object.keys(uk.empty)).toEqual(Object.keys(en.empty));
    expect(Object.keys(uk.options)).toEqual(Object.keys(en.options));
    expect(Object.keys(uk.optionsGet)).toEqual(Object.keys(en.optionsGet));
    expect(Object.keys(uk.generation)).toEqual(Object.keys(en.generation));
    expect(Object.keys(uk.confirm)).toEqual(Object.keys(en.confirm));
    expect(Object.keys(uk.handover)).toEqual(Object.keys(en.handover));
    expect(Object.keys(uk.toast)).toEqual(Object.keys(en.toast));
    expect(Object.keys(uk.mutation)).toEqual(Object.keys(en.mutation));
    expect(Object.keys(uk.form)).toEqual(Object.keys(en.form));
    expect(Object.keys(uk.form.errors)).toEqual(Object.keys(en.form.errors));
    expect(Object.keys(uk.shared)).toEqual(Object.keys(en.shared));
    expect(Object.keys(uk.signing)).toEqual(Object.keys(en.signing));
    expect(Object.keys(uk.signing.banners)).toEqual(
      Object.keys(en.signing.banners),
    );
  });

  it("pins canvas list copy in uk (type chips, no search)", () => {
    const uk = documentsCopy("uk");
    const en = documentsCopy("en");
    expect(uk.title).toBe("Документи");
    expect(uk.createLabel).toBe("Новий документ");
    expect(uk.filters).toEqual({
      all: "Усі",
      payment_invoice: "Рахунок",
      delivery_note: "Видаткова",
    });
    expect(uk.cancelledBadge).toBe("Скасовано");
    expect(uk.empty.catalogTitle).toBe("Документів ще немає");
    expect(uk.empty.filteredTitle).toBe("Нічого не знайдено");
    expect(uk.empty.filteredDescription).toBe("Змініть фільтр типу.");
    expect(uk.empty.filteredOrderDescription).toBe(
      "Для цього замовлення документів немає.",
    );
    expect(uk.empty.filteredTypeAndOrderDescription).toBe(
      "Змініть фільтр типу. Список залишиться в межах цього замовлення.",
    );
    expect(uk.empty.reset).toBe("Скинути");
    expect(uk.optionsGet.loading).toBe("Завантаження статусу PDF");
    expect(uk.optionsButton).toBe("Опції");
    expect(uk.options.share).toBe("Поділитися");
    expect(uk.options.qr).toBe("QR-код");
    expect(uk.options.print).toBe("Друк");
    expect(uk.options.openPdf).toBe("Відкрити PDF");
    expect(uk.options.sign).toBe("Підписати");
    expect(uk.options.cancel).toBe("Скасувати документ");
    expect(uk.confirm.cancelTitle).toBe("Скасувати документ?");
    expect(uk.signButton).toBe("Підписати");
    expect(uk.signing.title).toBe("Підписання документа");
    expect(uk.signing.lock).toContain("цьому пристрої");
    expect(JSON.stringify(uk.filters)).not.toMatch(/Пошук/);
    expect(uk.form.typePaymentInvoice).toBe("Рахунок РХ");
    expect(uk.form.typeDeliveryNote).toBe("Видаткова ВН");
    expect(uk.form.layoutSectionTitle).toBe("Вигляд");
    expect(uk.form.basisLabel).toBe("Підстава");
    expect(uk.form.errors.layoutRequired).toBe("Оберіть вигляд.");
    expect(en.form.errors.basisTooLong).toContain("500");
    expect(uk.form.orderSearchPlaceholder).toContain("Пошук");
    expect(uk.form.submitCreate).toBe("Створити");
    expect(en.form.submitCreate).toBe("Create");
    expect(uk.shared.refresh).toContain("оновити");
    expect(uk.shared.downloadSigned).toBe("Завантажити підписаний файл");
  });

  it("uses VALIDATION banner copy that does not assume highlighted fields", () => {
    const uk = documentsCopy("uk");
    const en = documentsCopy("en");
    expect(en.form.errors.validation).toBe(
      "Could not create the document. Check the seller legal details, customer, and counterparty.",
    );
    expect(uk.form.errors.validation).toBe(
      "Не вдалося створити документ. Перевірте реквізити продавця, клієнта та контрагента.",
    );
    expect(en.form.errors.validation).not.toMatch(/highlight/i);
    expect(uk.form.errors.validation).not.toMatch(/позначен|виділен/i);
  });
});
