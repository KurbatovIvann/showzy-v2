import { describe, expect, it } from "vitest";

import { customersCopy } from "../../../i18n/customers";
import { memberCountLabel } from "./member-count";

describe("memberCountLabel", () => {
  it("uses Ukrainian one/few/many including zero as many", () => {
    const forms = customersCopy("uk").members;
    expect(memberCountLabel(0, "uk", forms)).toBe("0 клієнтів");
    expect(memberCountLabel(1, "uk", forms)).toBe("1 клієнт");
    expect(memberCountLabel(3, "uk", forms)).toBe("3 клієнти");
    expect(memberCountLabel(11, "uk", forms)).toBe("11 клієнтів");
  });

  it("uses English one/other", () => {
    const forms = customersCopy("en").members;
    expect(memberCountLabel(1, "en", forms)).toBe("1 client");
    expect(memberCountLabel(4, "en", forms)).toBe("4 clients");
  });
});
