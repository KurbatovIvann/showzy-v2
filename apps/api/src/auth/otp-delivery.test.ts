import { describe, expect, it } from "vitest";

import {
  OTP_EMAIL_SUBJECT,
  buildOtpEmailHtml,
  composeOtpSenders,
  createStubEmailTransport,
  createStubSmsTransport,
  otpSendersFromConfig,
  otpSmsText,
  type EmailTransport,
  type SmsTransport,
} from "./otp-delivery.js";

const PHONE = "+380501234567";
const EMAIL = "owner@example.com";
const CODE = "847291";

function recordingEmail(): {
  transport: EmailTransport;
  sent: { to: string; subject: string; html: string }[];
} {
  const sent: { to: string; subject: string; html: string }[] = [];
  return {
    sent,
    transport: {
      send: (input) => {
        sent.push(input);
        return Promise.resolve();
      },
    },
  };
}

function recordingSms(): {
  transport: SmsTransport;
  sent: { to: string; text: string }[];
} {
  const sent: { to: string; text: string }[] = [];
  return {
    sent,
    transport: {
      send: (input) => {
        sent.push(input);
        return Promise.resolve();
      },
    },
  };
}

describe("otp copy", () => {
  it("maps the v1 Ukrainian SMS body", () => {
    expect(otpSmsText(CODE)).toBe(`Ваш код: ${CODE}`);
  });

  it("maps the v1 Шозі HTML email without depending on vendor HTTP", () => {
    const html = buildOtpEmailHtml(CODE, 2026);
    expect(OTP_EMAIL_SUBJECT).toBe("Ваш код підтвердження для Шозі");
    expect(html).toContain("Шозі");
    expect(html).toContain(CODE);
    expect(html).toContain("Код дійсний протягом 5 хвилин.");
    expect(html).toContain("© 2026 Шозі");
  });
});

describe("composeOtpSenders", () => {
  it("maps OTP copy onto the email and SMS ports", async () => {
    const email = recordingEmail();
    const sms = recordingSms();
    const senders = composeOtpSenders({
      email: email.transport,
      sms: sms.transport,
    });

    await senders.sendPhoneOtp({ phoneNumber: PHONE, code: CODE });
    await senders.sendEmailOtp({
      email: EMAIL,
      otp: CODE,
      type: "sign-in",
    });

    expect(sms.sent).toEqual([{ to: PHONE, text: `Ваш код: ${CODE}` }]);
    expect(email.sent).toHaveLength(1);
    expect(email.sent[0]?.to).toBe(EMAIL);
    expect(email.sent[0]?.subject).toBe(OTP_EMAIL_SUBJECT);
    expect(email.sent[0]?.html).toContain(CODE);
    expect(email.sent[0]?.html).toContain("Шозі");
  });

  it("stub senders fulfill AuthComposition without I/O", async () => {
    const senders = composeOtpSenders({
      email: createStubEmailTransport(),
      sms: createStubSmsTransport(),
    });

    await expect(
      senders.sendPhoneOtp({ phoneNumber: PHONE, code: CODE }),
    ).resolves.toBeUndefined();
    await expect(
      senders.sendEmailOtp({
        email: EMAIL,
        otp: CODE,
        type: "email-verification",
      }),
    ).resolves.toBeUndefined();
  });
});

describe("selectOtpTransports", () => {
  it("wires stubs from stub config", async () => {
    const senders = otpSendersFromConfig({
      email: { transport: "stub" },
      sms: {
        transport: "stub",
        apiUrl: "https://sms-fly.ua/api/v2/api.php",
      },
    });

    await expect(
      senders.sendPhoneOtp({ phoneNumber: PHONE, code: CODE }),
    ).resolves.toBeUndefined();
  });
});
