import { describe, expect, it } from "vitest";

import { resolveTextFieldContent } from "./text-field-content";

describe("resolveTextFieldContent", () => {
  it("does not force iOS password content type when autocomplete is off", () => {
    expect(
      resolveTextFieldContent({
        secure: true,
        autoComplete: "off",
        keyboardType: "default",
      }),
    ).toEqual({ autoComplete: "off", textContentType: "none" });
  });

  it("keeps password autofill when autocomplete is password", () => {
    expect(
      resolveTextFieldContent({
        secure: true,
        autoComplete: "password",
        keyboardType: "default",
      }),
    ).toEqual({ autoComplete: "password", textContentType: "password" });
  });
});
