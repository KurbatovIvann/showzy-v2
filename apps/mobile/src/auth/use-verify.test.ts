import { describe, expect, it } from "vitest";

import { verifySubmitDisabled } from "./auth-submit";

describe("verifySubmitDisabled", () => {
  it("disables on empty code, busy, or locked", () => {
    expect(verifySubmitDisabled({ code: "", busy: false, locked: false })).toBe(
      true,
    );
    expect(
      verifySubmitDisabled({ code: "123456", busy: true, locked: false }),
    ).toBe(true);
    expect(
      verifySubmitDisabled({ code: "123456", busy: false, locked: true }),
    ).toBe(true);
  });

  it("enables when a code is present and the form is idle", () => {
    expect(
      verifySubmitDisabled({ code: "123456", busy: false, locked: false }),
    ).toBe(false);
  });
});
