/**
 * OTP delivery ports and compose (auth-T1). Copy is mapped here; vendor HTTP
 * adapters are selected from config and land in auth-T2. Stubs succeed with
 * no I/O and never log the message body or the code.
 */
import type { ServerConfig } from "@showzy/config";

import type { AuthComposition } from "./options.js";

export interface EmailTransport {
  send(input: { to: string; subject: string; html: string }): Promise<void>;
}

export interface SmsTransport {
  send(input: { to: string; text: string }): Promise<void>;
}

export class OtpTransportNotWiredError extends Error {
  constructor(channel: "email" | "sms", transport: string) {
    super(
      `OTP ${channel} transport "${transport}" has no adapter in this process.`,
    );
    this.name = "OtpTransportNotWiredError";
  }
}

export const OTP_EMAIL_SUBJECT = "Ваш код підтвердження для Шозі";

export function otpSmsText(code: string): string {
  return `Ваш код: ${code}`;
}

/** v1 Шозі HTML email. The code is interpolated; callers must not log `html`. */
export function buildOtpEmailHtml(
  code: string,
  year = new Date().getFullYear(),
): string {
  return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);">
              <h1 style="color: #1a1a1a; font-size: 24px; margin: 0 0 16px 0; text-align: center;">
                Шозі
              </h1>
              <p style="color: #666; font-size: 16px; line-height: 24px; margin: 0 0 24px 0; text-align: center;">
                Ваш код підтвердження:
              </p>
              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 24px; text-align: center; margin: 0 0 24px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1a1a1a;">
                  ${code}
                </span>
              </div>
              <p style="color: #999; font-size: 14px; line-height: 20px; margin: 0; text-align: center;">
                Код дійсний протягом 5 хвилин.<br>
                Якщо ви не запитували цей код, просто ігноруйте цей лист.
              </p>
            </div>
            <p style="color: #999; font-size: 12px; text-align: center; margin: 24px 0 0 0;">
              © ${String(year)} Шозі. Всі права захищені.
            </p>
          </div>
        </body>
      </html>
    `;
}

export function createStubEmailTransport(): EmailTransport {
  return {
    async send() {
      // No I/O. The body (including the OTP) is never logged.
    },
  };
}

export function createStubSmsTransport(): SmsTransport {
  return {
    async send() {
      // No I/O. The body (including the OTP) is never logged.
    },
  };
}

export function selectOtpTransports(otpDelivery: ServerConfig["otpDelivery"]): {
  email: EmailTransport;
  sms: SmsTransport;
} {
  return {
    email: emailTransportFor(otpDelivery.email),
    sms: smsTransportFor(otpDelivery.sms),
  };
}

function emailTransportFor(
  email: ServerConfig["otpDelivery"]["email"],
): EmailTransport {
  switch (email.transport) {
    case "stub":
      return createStubEmailTransport();
    case "resend":
      throw new OtpTransportNotWiredError("email", email.transport);
  }
}

function smsTransportFor(
  sms: ServerConfig["otpDelivery"]["sms"],
): SmsTransport {
  switch (sms.transport) {
    case "stub":
      return createStubSmsTransport();
    case "sms-fly":
      throw new OtpTransportNotWiredError("sms", sms.transport);
  }
}

export function composeOtpSenders(transports: {
  readonly email: EmailTransport;
  readonly sms: SmsTransport;
}): Pick<AuthComposition, "sendPhoneOtp" | "sendEmailOtp"> {
  return {
    sendPhoneOtp: async ({ phoneNumber, code }) => {
      await transports.sms.send({
        to: phoneNumber,
        text: otpSmsText(code),
      });
    },
    sendEmailOtp: async ({ email, otp }) => {
      await transports.email.send({
        to: email,
        subject: OTP_EMAIL_SUBJECT,
        html: buildOtpEmailHtml(otp),
      });
    },
  };
}

export function otpSendersFromConfig(
  otpDelivery: ServerConfig["otpDelivery"],
): Pick<AuthComposition, "sendPhoneOtp" | "sendEmailOtp"> {
  return composeOtpSenders(selectOtpTransports(otpDelivery));
}
