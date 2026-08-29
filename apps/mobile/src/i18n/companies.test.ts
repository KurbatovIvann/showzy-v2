import { describe, expect, it } from "vitest";

import { companiesCopy } from "./companies";
import { detectLocale, interpolate } from "./locale";

describe("companies copy", () => {
  it("defaults to Ukrainian and picks English only from an en locale", () => {
    expect(companiesCopy(detectLocale()).title).toBe("Компанія");
    expect(companiesCopy(detectLocale("en-US")).title).toBe("Company");
  });

  it("keeps uk/en key parity across the namespace", () => {
    const uk = companiesCopy("uk");
    const en = companiesCopy("en");
    expect(Object.keys(uk)).toEqual(Object.keys(en));
  });

  it("pins canvas hub copy in uk and en", () => {
    const uk = companiesCopy("uk");
    const en = companiesCopy("en");
    expect(uk.title).toBe("Компанія");
    expect(en.title).toBe("Company");
    expect(uk.prefixTitle).toBe("Префікс номерів");
    expect(en.prefixTitle).toBe("Number prefix");
    expect(uk.legalLabel).toBe("Юридичні реквізити");
    expect(en.legalLabel).toBe("Legal requisites");
    expect(uk.legalMissing).toBe("Ще не додано — потрібні для рахунків");
    expect(en.legalMissing).toBe("Not added yet — required for invoices");
    expect(uk.documentsSection).toBe("Документи");
    expect(en.documentsSection).toBe("Documents");
    expect(uk.slugDisplay).toBe("shozee.com.ua/{{slug}}");
    expect(en.slugDisplay).toBe("shozee.com.ua/{{slug}}");
    expect(uk.prefixExplanation).toContain("{{prefix}}-1048");
    expect(en.prefixExplanation).toContain("{{prefix}}-1048");
    expect(interpolate(uk.prefixExplanation, { prefix: "SP" })).toBe(
      "Замовлення і рахунки нумеруються як SP-1048. Код не змінюється.",
    );
    expect(interpolate(en.prefixExplanation, { prefix: "SP" })).toBe(
      "Orders and invoices are numbered SP-1048. The code does not change.",
    );
    expect(uk.permissionTitle).toBe("Немає права");
    expect(en.permissionTitle).toBe("No permission");
    expect(uk.legalStubDescription).toBe("Цей розділ незабаром з’явиться.");
    expect(en.legalStubDescription).toBe("This section is coming soon.");
  });
});
