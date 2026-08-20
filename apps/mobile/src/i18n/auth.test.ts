import { describe, expect, it } from "vitest";

import { authCopy, errorCopy, verifyMessage } from "./auth";
import { detectLocale, interpolate } from "./locale";

describe("auth copy", () => {
  it("picks Ukrainian from a uk locale and English otherwise", () => {
    expect(detectLocale("uk-UA")).toBe("uk");
    expect(detectLocale("UK")).toBe("uk");
    expect(detectLocale("en-US")).toBe("en");
    expect(authCopy("uk").welcome).toBe("Ласкаво просимо");
    expect(authCopy("en").welcome).toBe("Welcome");
  });

  it("interpolates destination without treating the code as copy", () => {
    expect(interpolate("Resend in {{seconds}}s", { seconds: "12" })).toBe(
      "Resend in 12s",
    );
    expect(verifyMessage(authCopy("en"), "phone", "+380671112233")).toContain(
      "+380671112233",
    );
    expect(errorCopy(authCopy("en"), "invalid_otp")).toBe(
      "Invalid verification code",
    );
    expect(errorCopy(authCopy("en"), "resend_limited")).toMatch(/Too many OTP/);
  });
});
