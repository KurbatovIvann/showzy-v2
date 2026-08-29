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
    expect(Object.keys(uk.generation)).toEqual(Object.keys(en.generation));
    expect(Object.keys(uk.confirm)).toEqual(Object.keys(en.confirm));
    expect(Object.keys(uk.handover)).toEqual(Object.keys(en.handover));
    expect(Object.keys(uk.toast)).toEqual(Object.keys(en.toast));
    expect(Object.keys(uk.mutation)).toEqual(Object.keys(en.mutation));
  });

  it("pins canvas list copy in uk (type chips, no search)", () => {
    const uk = documentsCopy("uk");
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
    expect(uk.empty.reset).toBe("Скинути");
    expect(uk.optionsButton).toBe("Опції");
    expect(uk.options.share).toBe("Поділитися");
    expect(uk.options.qr).toBe("QR-код");
    expect(uk.options.print).toBe("Друк");
    expect(uk.options.openPdf).toBe("Відкрити PDF");
    expect(uk.options.cancel).toBe("Скасувати документ");
    expect(uk.confirm.cancelTitle).toBe("Скасувати документ?");
    expect(JSON.stringify(uk)).not.toMatch(/Пошук/);
  });
});
