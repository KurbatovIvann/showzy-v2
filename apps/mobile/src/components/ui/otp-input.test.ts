import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(
  new URL("./otp-input.tsx", import.meta.url),
  "utf8",
);

describe("OtpInput a11y and error split", () => {
  it("splits error styling from error text", () => {
    expect(SOURCE).toContain("readonly error?: boolean");
    expect(SOURCE).toContain("readonly errorText?: string");
    expect(SOURCE).not.toContain("error?: boolean | string");
  });

  it("hides digit cells from screen readers next to the hidden input", () => {
    expect(SOURCE).toContain('importantForAccessibility="no-hide-descendants"');
    expect(SOURCE).toContain("accessibilityElementsHidden");
    expect(SOURCE).toContain("<Text accessible={false}");
  });
});
