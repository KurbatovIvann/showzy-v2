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
      "Invalid code. Check the digits and try again.",
    );
    expect(errorCopy(authCopy("en"), "resend_limited")).toMatch(/Too many OTP/);
  });

  it("pins canvas auth keys in uk and en", () => {
    const uk = authCopy("uk");
    const en = authCopy("en");
    expect(uk.tagline).toBe("Керуйте замовленнями легко та впевнено");
    expect(en.tagline).toBe("Manage orders easily and confidently");
    expect(uk.phoneLabel).toBe("Номер телефону");
    expect(en.phoneLabel).toBe("Phone number");
    expect(uk.emailLabel).toBe("Email-адреса");
    expect(en.emailLabel).toBe("Email address");
    expect(uk.wrongNumber).toBe("Змінити номер");
    expect(en.wrongNumber).toBe("Change number");
    expect(uk.wrongEmail).toBe("Змінити email");
    expect(en.wrongEmail).toBe("Change email");
    expect(uk.resendCode).toBe("Надіслати код повторно");
    expect(en.resendCode).toBe("Resend code");
    expect(uk.resendCodeIn).toBe("Надіслати повторно через {{seconds}} с");
    expect(en.resendCodeIn).toBe("Resend in {{seconds}}s");
    expect(uk.continueLoading).toBe("Зачекайте…");
    expect(en.continueLoading).toBe("Please wait…");
    expect(uk.verifyLoading).toBe("Перевіряємо…");
    expect(en.verifyLoading).toBe("Verifying…");
    expect(errorCopy(uk, "invalid_otp")).toBe(
      "Невірний код. Перевірте цифри та спробуйте ще раз.",
    );
  });
});
