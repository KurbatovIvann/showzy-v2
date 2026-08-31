import { describe, expect, it } from "vitest";

import { signInSubmitDisabled } from "./auth-submit";

describe("signInSubmitDisabled", () => {
  it("disables when the phone digits or trimmed email are empty", () => {
    expect(
      signInSubmitDisabled({
        channel: "phone",
        phoneDigits: "",
        email: "user@example.com",
        busy: false,
      }),
    ).toBe(true);
    expect(
      signInSubmitDisabled({
        channel: "email",
        phoneDigits: "671112233",
        email: "   ",
        busy: false,
      }),
    ).toBe(true);
  });

  it("disables while busy and enables when the identifier is present", () => {
    expect(
      signInSubmitDisabled({
        channel: "phone",
        phoneDigits: "671112233",
        email: "",
        busy: true,
      }),
    ).toBe(true);
    expect(
      signInSubmitDisabled({
        channel: "email",
        phoneDigits: "",
        email: "user@example.com",
        busy: false,
      }),
    ).toBe(false);
  });
});
