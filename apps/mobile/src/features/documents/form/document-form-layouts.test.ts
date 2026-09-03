import { describe, expect, it } from "vitest";

import {
  defaultLayoutKey,
  layoutCardLabel,
  nextLayoutKeyOnCatalog,
  showsBasisField,
  showsLayoutPicker,
  wireBasis,
  type DocumentLayoutOption,
} from "./document-form-layouts";

const INVOICE_LAYOUTS: readonly DocumentLayoutOption[] = [
  {
    key: "payment_invoice.branded",
    type: "payment_invoice",
    labelUk: "Фірмовий рахунок",
    labelEn: "Branded invoice",
    isDefault: true,
  },
];

const NOTE_LAYOUTS: readonly DocumentLayoutOption[] = [
  {
    key: "delivery_note.parties",
    type: "delivery_note",
    labelUk: "Накладна зі сторонами",
    labelEn: "Parties delivery note",
    isDefault: true,
  },
];

describe("document form layouts", () => {
  it("switching type changes the offered keys and default", () => {
    expect(INVOICE_LAYOUTS.map((row) => row.key)).toEqual([
      "payment_invoice.branded",
    ]);
    expect(NOTE_LAYOUTS.map((row) => row.key)).toEqual([
      "delivery_note.parties",
    ]);
    expect(defaultLayoutKey(INVOICE_LAYOUTS)).toBe("payment_invoice.branded");
    expect(defaultLayoutKey(NOTE_LAYOUTS)).toBe("delivery_note.parties");
    expect(
      nextLayoutKeyOnCatalog(NOTE_LAYOUTS, "payment_invoice.branded"),
    ).toBe("delivery_note.parties");
    expect(
      nextLayoutKeyOnCatalog(INVOICE_LAYOUTS, "delivery_note.parties"),
    ).toBe("payment_invoice.branded");
    expect(
      nextLayoutKeyOnCatalog(INVOICE_LAYOUTS, "payment_invoice.plain"),
    ).toBe("payment_invoice.branded");
  });

  it("labels from labelUk / labelEn depending on locale", () => {
    const branded = INVOICE_LAYOUTS[0];
    expect(branded).toBeDefined();
    if (branded === undefined) {
      return;
    }
    expect(layoutCardLabel(branded, "uk")).toBe("Фірмовий рахунок");
    expect(layoutCardLabel(branded, "en")).toBe("Branded invoice");
  });

  it("hides the look picker when the catalog has a single ready choice", () => {
    expect(showsLayoutPicker("loading", 0)).toBe(false);
    expect(showsLayoutPicker("error", 0)).toBe(true);
    expect(showsLayoutPicker("ready", 0)).toBe(false);
    expect(showsLayoutPicker("ready", 1)).toBe(false);
    expect(showsLayoutPicker("ready", 2)).toBe(true);
  });

  it("omits basis for invoices and blank delivery-note text", () => {
    expect(showsBasisField("payment_invoice")).toBe(false);
    expect(showsBasisField("delivery_note")).toBe(true);
    expect(wireBasis("payment_invoice", "Договір № 1")).toBeUndefined();
    expect(wireBasis("delivery_note", "   ")).toBeUndefined();
    expect(wireBasis("delivery_note", "")).toBeUndefined();
    expect(wireBasis("delivery_note", "  Договір № 1  ")).toBe("Договір № 1");
  });
});
