import { describe, expect, it } from "vitest";

import { panelChromeCopy } from "../../i18n/panel/chrome";
import {
  accountDisplayLabel,
  accountInitials,
  roleLabel,
} from "./account-label";

describe("accountDisplayLabel", () => {
  it("prefers email, then phone, then fallback", () => {
    expect(
      accountDisplayLabel(
        { userId: "u", email: "owner@example.com", phoneNumber: null },
        "Акаунт",
      ),
    ).toBe("owner@example.com");
    expect(
      accountDisplayLabel(
        { userId: "u", email: null, phoneNumber: "+380671112233" },
        "Акаунт",
      ),
    ).toBe("+380671112233");
    expect(accountDisplayLabel(null, "Акаунт")).toBe("Акаунт");
  });
});

describe("accountInitials", () => {
  it("uses the local-part first letter or last two phone digits", () => {
    expect(accountInitials("owner@example.com")).toBe("O");
    expect(accountInitials("+380671112233")).toBe("33");
    expect(accountInitials("")).toBe("?");
  });
});

describe("roleLabel", () => {
  it("maps membership roles from chrome copy", () => {
    expect(roleLabel("owner", panelChromeCopy("uk"))).toBe("Власник");
    expect(roleLabel("manager", panelChromeCopy("en"))).toBe("Manager");
  });
});
