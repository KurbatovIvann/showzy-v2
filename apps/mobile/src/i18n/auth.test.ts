import { describe, expect, it } from "vitest";

import { authCopy, errorCopy, verifyMessageParts } from "./auth";
import { detectLocale, interpolate } from "./locale";

describe("auth copy", () => {
  it("defaults to Ukrainian and picks English only from an en locale", () => {
    expect(detectLocale()).toBe("uk");
    expect(detectLocale("uk-UA")).toBe("uk");
    expect(detectLocale("UK")).toBe("uk");
    expect(detectLocale("de-DE")).toBe("uk");
    expect(detectLocale("en-US")).toBe("en");
    expect(authCopy("uk").welcome).toBe("Ласкаво просимо");
    expect(authCopy("en").welcome).toBe("Welcome");
  });

  it("splits verify templates around the first destination placeholder", () => {
    expect(interpolate("Resend in {{seconds}}s", { seconds: "12" })).toBe(
      "Resend in 12s",
    );
    expect(verifyMessageParts("code with no destination")).toEqual({
      before: "code with no destination",
      after: "",
    });
    expect(verifyMessageParts("We've sent a code to {{destination}}")).toEqual({
      before: "We've sent a code to ",
      after: "",
    });
    expect(
      verifyMessageParts("to {{destination}} and {{destination}} again"),
    ).toEqual({
      before: "to ",
      after: " and {{destination}} again",
    });
    const enPhone = verifyMessageParts(authCopy("en").verifyPhoneMessage);
    expect(`${enPhone.before}+380671112233${enPhone.after}`).toContain(
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
