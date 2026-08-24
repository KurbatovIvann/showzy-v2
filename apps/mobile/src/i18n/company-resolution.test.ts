import { describe, expect, it } from "vitest";

import { companyResolutionCopy } from "./company-resolution";

describe("company resolution copy", () => {
  it("keeps uk/en key parity and localized accessibility labels", () => {
    const uk = companyResolutionCopy("uk");
    const en = companyResolutionCopy("en");

    expect(Object.keys(uk)).toEqual(Object.keys(en));
    expect(uk.loading).toBe("Завантаження вашої компанії");
    expect(en.loading).toBe("Loading your company");
    expect(uk.retry).toBe("Спробувати ще раз");
    expect(en.retry).toBe("Try Again");
    expect(uk.multipleTitle).toBe("Оберіть компанію");
    expect(en.multipleTitle).toBe("Choose a company");
    expect(uk.signOut).toBe("Вийти");
    expect(en.signOut).toBe("Sign Out");
  });
});
