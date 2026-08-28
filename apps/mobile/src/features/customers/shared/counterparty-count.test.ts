import { describe, expect, it } from "vitest";

import { customersCopy } from "../../../i18n/customers";
import { counterpartyCountLabel } from "./counterparty-count";

describe("counterpartyCountLabel", () => {
  it("omits the pill when the count is zero", () => {
    expect(
      counterpartyCountLabel(0, "uk", customersCopy("uk").counterparties),
    ).toBeNull();
  });

  it("uses Ukrainian one/few/many forms", () => {
    const forms = customersCopy("uk").counterparties;
    expect(counterpartyCountLabel(1, "uk", forms)).toBe("1 контрагент");
    expect(counterpartyCountLabel(2, "uk", forms)).toBe("2 контрагенти");
    expect(counterpartyCountLabel(5, "uk", forms)).toBe("5 контрагентів");
  });

  it("uses English one/other", () => {
    const forms = customersCopy("en").counterparties;
    expect(counterpartyCountLabel(1, "en", forms)).toBe("1 counterparty");
    expect(counterpartyCountLabel(3, "en", forms)).toBe("3 counterparties");
  });
});
