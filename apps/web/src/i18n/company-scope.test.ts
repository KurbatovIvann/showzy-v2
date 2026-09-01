import { describe, expect, it } from "vitest";

import { companyScopeCopy } from "./company-scope";
import { detectLocale } from "./locale";

describe("company-scope copy", () => {
  it("defaults to Ukrainian and picks English only from an en locale", () => {
    expect(detectLocale()).toBe("uk");
    expect(companyScopeCopy("uk").pickerTitle).toBe("Оберіть компанію");
    expect(companyScopeCopy("en").pickerTitle).toBe("Choose a company");
    expect(companyScopeCopy("uk").unknownTitle).toBe("Компанію не знайдено");
    expect(companyScopeCopy("en").emptyTitle).toBe("No companies");
    expect(companyScopeCopy("uk").switcher).toBe("Компанія");
  });
});
