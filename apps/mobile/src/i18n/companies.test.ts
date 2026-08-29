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
    expect(Object.keys(uk.legalForm)).toEqual(Object.keys(en.legalForm));
    expect(Object.keys(uk.legalForm.errors)).toEqual(
      Object.keys(en.legalForm.errors),
    );
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
  });

  it("pins legal editor field-family copy in uk and en", () => {
    const uk = companiesCopy("uk").legalForm;
    const en = companiesCopy("en").legalForm;
    expect(uk.typeFop).toBe("ФОП");
    expect(en.typeFop).toBe("FOP");
    expect(uk.typeTov).toBe("ТОВ");
    expect(en.typeTov).toBe("LLC");
    expect(uk.legalNameLabel).toBe("Юридична назва");
    expect(en.legalNameLabel).toBe("Legal name");
    expect(uk.edrpouLabel).toBe("ЄДРПОУ / ІПН");
    expect(en.edrpouLabel).toBe("EDRPOU / TIN");
    expect(uk.legalAddressLabel).toBe("Юридична адреса");
    expect(en.legalAddressLabel).toBe("Legal address");
    expect(uk.ibanLabel).toBe("IBAN");
    expect(en.ibanLabel).toBe("IBAN");
    expect(uk.bankNameLabel).toBe("Банк");
    expect(en.bankNameLabel).toBe("Bank");
    expect(uk.bankMfoLabel).toBe("МФО");
    expect(en.bankMfoLabel).toBe("MFO");
    expect(uk.bankEdrpouLabel).toBe("ЄДРПОУ банку (необовʼязково)");
    expect(en.bankEdrpouLabel).toBe("Bank EDRPOU (optional)");
    expect(uk.phoneLabel).toBe("Телефон");
    expect(en.phoneLabel).toBe("Phone");
    expect(uk.emailLabel).toBe("Email (необовʼязково)");
    expect(en.emailLabel).toBe("Email (optional)");
    expect(uk.submitAdd).toBe("Додати реквізити");
    expect(en.submitAdd).toBe("Add requisites");
    expect(uk.submitEdit).toBe("Зберегти");
    expect(en.submitEdit).toBe("Save");
    expect(uk.errors.legalNameRequired).toBe("Вкажіть юридичну назву");
    expect(en.errors.legalNameRequired).toBe("Enter the legal name");
    expect(uk.errors.validation).toBe("Перевірте виділені поля.");
    expect(en.errors.validation).toBe("Check the highlighted fields.");
    expect(uk.contactsHelper).toBe("Можуть відрізнятися від контактів профілю");
    expect(en.contactsHelper).toBe("May differ from profile contacts");
  });
});
