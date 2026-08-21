import { createProcessLogger } from "@showzy/config";
import { describe, expect, it } from "vitest";

import {
  OTP_EMAIL_SUBJECT,
  buildOtpEmailHtml,
  composeOtpSenders,
  otpSendersFromConfig,
  otpSmsText,
} from "./otp-delivery.js";
import {
  OtpVendorSendError,
  RESEND_EMAILS_URL,
  SMS_FLY_TTL_SECONDS,
  e164Digits,
  type OtpVendorFetch,
} from "./otp-vendor.js";
import { createResendEmailTransport } from "./resend-email-transport.js";
import { createSmsFlySmsTransport } from "./sms-fly-sms-transport.js";

const PHONE = "+380501234567";
const EMAIL = "owner@example.com";
const CODE = "847291";
const RESEND_API_KEY = "re_test_not_a_real_key_000000";
const SMS_FLY_API_KEY = "test-sms-fly-key-not-real-0000";
const SMS_FLY_API_URL = "https://sms-fly.ua/api/v2/api.php";
const FROM_EMAIL = "noreply@example.com";
const FROM_NAME = "Шозі";
const SENDER = "Showzy";

type FetchCall = { url: string; init: RequestInit };

function captureLogger(name = "otp-adapter-test"): {
  logger: ReturnType<typeof createProcessLogger>;
  dump: () => string;
} {
  const lines: string[] = [];
  const logger = createProcessLogger({
    name,
    destination: {
      write(chunk: string) {
        lines.push(chunk);
      },
    },
  });
  return {
    logger,
    dump: () => lines.join("\n"),
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function recordingFetch(
  handler: (call: FetchCall) => Response | Promise<Response>,
): {
  fetch: OtpVendorFetch;
  calls: FetchCall[];
} {
  const calls: FetchCall[] = [];
  return {
    calls,
    fetch: async (url, init) => {
      const call = { url, init };
      calls.push(call);
      return handler(call);
    },
  };
}

function hangingFetch(): OtpVendorFetch {
  return (_url, init) =>
    new Promise((_resolve, reject) => {
      const abort = () => {
        reject(
          new DOMException(
            "The operation was aborted due to timeout",
            "TimeoutError",
          ),
        );
      };
      if (init.signal?.aborted === true) {
        abort();
        return;
      }
      init.signal?.addEventListener("abort", abort, { once: true });
    });
}

function requestBody(init: RequestInit | undefined): unknown {
  if (typeof init?.body !== "string") {
    throw new Error("expected JSON string body");
  }
  return JSON.parse(init.body);
}

function header(init: RequestInit | undefined, name: string): string | null {
  return new Headers(init?.headers).get(name);
}

describe("createResendEmailTransport", () => {
  it("POSTs emails.send shape and does not log the OTP or API key", async () => {
    const { logger, dump } = captureLogger("resend-ok");
    const http = recordingFetch(() => jsonResponse({ id: "email_msg_1" }));
    const senders = composeOtpSenders({
      email: createResendEmailTransport({
        apiKey: RESEND_API_KEY,
        fromEmail: FROM_EMAIL,
        fromName: FROM_NAME,
        logger,
        fetch: http.fetch,
      }),
      sms: { send: () => Promise.resolve() },
    });

    await senders.sendEmailOtp({
      email: EMAIL,
      otp: CODE,
      type: "sign-in",
    });

    expect(http.calls).toHaveLength(1);
    const call = http.calls[0];
    expect(call?.url).toBe(RESEND_EMAILS_URL);
    expect(call?.init.method).toBe("POST");
    expect(call?.init.redirect).toBe("error");
    expect(header(call?.init, "Authorization")).toBe(
      `Bearer ${RESEND_API_KEY}`,
    );
    expect(header(call?.init, "Content-Type")).toBe("application/json");
    const body = requestBody(call?.init);
    expect(body).toEqual({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: EMAIL,
      subject: OTP_EMAIL_SUBJECT,
      html: buildOtpEmailHtml(CODE),
    });

    const logs = dump();
    expect(logs).toContain("OTP email sent");
    expect(logs).toContain("email_msg_1");
    expect(logs).not.toContain(CODE);
    expect(logs).not.toContain(RESEND_API_KEY);
    expect(logs).not.toContain(EMAIL);
  });

  it("throws on 4xx, 5xx, timeout, and a 200 without id", async () => {
    const { logger } = captureLogger("resend-fail");
    const html = "<p>secret-otp-html</p>";

    const fail = async (
      fetchImpl: OtpVendorFetch,
      timeoutMs?: number,
    ): Promise<unknown> => {
      const transport = createResendEmailTransport({
        apiKey: RESEND_API_KEY,
        fromEmail: FROM_EMAIL,
        fromName: FROM_NAME,
        logger,
        fetch: fetchImpl,
        timeoutMs,
      });
      return transport.send({
        to: EMAIL,
        subject: OTP_EMAIL_SUBJECT,
        html,
      });
    };

    await expect(
      fail(recordingFetch(() => jsonResponse({ message: "nope" }, 422)).fetch),
    ).rejects.toMatchObject({
      name: "OtpVendorSendError",
      message: "Resend request failed with status 422",
    });

    await expect(
      fail(recordingFetch(() => jsonResponse({ message: "down" }, 503)).fetch),
    ).rejects.toBeInstanceOf(OtpVendorSendError);

    await expect(fail(hangingFetch(), 20)).rejects.toMatchObject({
      name: "OtpVendorSendError",
      message: "Resend request timed out",
    });

    await expect(
      fail(recordingFetch(() => jsonResponse({ ok: true })).fetch),
    ).rejects.toMatchObject({
      name: "OtpVendorSendError",
      message: "Resend returned an unsuccessful payload",
    });
  });
});

describe("createSmsFlySmsTransport", () => {
  it("POSTs SENDMESSAGE with E.164 digits, ttl 60, and OTP copy text", async () => {
    const { logger, dump } = captureLogger("sms-ok");
    const http = recordingFetch(() =>
      jsonResponse({
        success: 1,
        data: { messageID: "sms_msg_1" },
      }),
    );
    const senders = composeOtpSenders({
      email: { send: () => Promise.resolve() },
      sms: createSmsFlySmsTransport({
        apiKey: SMS_FLY_API_KEY,
        apiUrl: SMS_FLY_API_URL,
        sender: SENDER,
        logger,
        fetch: http.fetch,
      }),
    });

    await senders.sendPhoneOtp({ phoneNumber: PHONE, code: CODE });

    expect(http.calls).toHaveLength(1);
    const call = http.calls[0];
    expect(call?.url).toBe(SMS_FLY_API_URL);
    expect(call?.init.method).toBe("POST");
    expect(call?.init.redirect).toBe("error");
    expect(requestBody(call?.init)).toEqual({
      auth: { key: SMS_FLY_API_KEY },
      action: "SENDMESSAGE",
      data: {
        recipient: "380501234567",
        channels: ["sms"],
        sms: {
          source: SENDER,
          ttl: SMS_FLY_TTL_SECONDS,
          text: otpSmsText(CODE),
        },
      },
    });

    const logs = dump();
    expect(logs).toContain("OTP SMS sent");
    expect(logs).toContain("sms_msg_1");
    expect(logs).toContain("+38050****67");
    expect(logs).not.toContain(CODE);
    expect(logs).not.toContain(SMS_FLY_API_KEY);
    expect(logs).not.toContain(PHONE);
  });

  it("throws on success=0, HTTP error, timeout, and non-E.164 recipients", async () => {
    const { logger, dump } = captureLogger("sms-fail");
    const text = otpSmsText(CODE);

    const fail = async (
      fetchImpl: OtpVendorFetch,
      to = PHONE,
      timeoutMs?: number,
    ): Promise<unknown> => {
      const transport = createSmsFlySmsTransport({
        apiKey: SMS_FLY_API_KEY,
        apiUrl: SMS_FLY_API_URL,
        sender: SENDER,
        logger,
        fetch: fetchImpl,
        timeoutMs,
      });
      return transport.send({ to, text });
    };

    const successZero = recordingFetch(() =>
      jsonResponse({
        success: 0,
        error: {
          code: "EXP",
          date: "2026-08-21 00:00:00",
          description: `leak ${CODE}`,
        },
      }),
    );
    await expect(fail(successZero.fetch)).rejects.toMatchObject({
      name: "OtpVendorSendError",
      message: "SMS Fly returned an unsuccessful payload",
    });
    expect(successZero.calls).toHaveLength(1);
    expect(dump()).not.toContain(CODE);
    expect(dump()).not.toContain("leak");

    await expect(
      fail(recordingFetch(() => jsonResponse({ error: "nope" }, 500)).fetch),
    ).rejects.toMatchObject({
      name: "OtpVendorSendError",
      message: "SMS Fly request failed with status 500",
    });

    await expect(fail(hangingFetch(), PHONE, 20)).rejects.toMatchObject({
      name: "OtpVendorSendError",
      message: "SMS Fly request timed out",
    });

    const skipped = recordingFetch(() => jsonResponse({ success: 1 }));
    await expect(fail(skipped.fetch, "0501234567")).rejects.toMatchObject({
      name: "OtpVendorSendError",
      message: "SMS recipient is not E.164",
    });
    await expect(fail(skipped.fetch, "380501234567")).rejects.toBeInstanceOf(
      OtpVendorSendError,
    );
    expect(skipped.calls).toHaveLength(0);
  });
});

describe("otpSendersFromConfig live vs stub", () => {
  it("still selects stub transports with no HTTP", async () => {
    const http = recordingFetch(() => jsonResponse({}));
    const senders = otpSendersFromConfig(
      {
        email: { transport: "stub" },
        sms: { transport: "stub", apiUrl: SMS_FLY_API_URL },
      },
      { fetch: http.fetch, logger: captureLogger("stub").logger },
    );

    await senders.sendPhoneOtp({ phoneNumber: PHONE, code: CODE });
    await senders.sendEmailOtp({
      email: EMAIL,
      otp: CODE,
      type: "email-verification",
    });
    expect(http.calls).toHaveLength(0);
  });

  it("wires resend and sms-fly from config onto the mocked vendors", async () => {
    const { logger } = captureLogger("compose-live");
    const http = recordingFetch((call) => {
      if (call.url === RESEND_EMAILS_URL) {
        return jsonResponse({ id: "email_wired" });
      }
      return jsonResponse({ success: 1, data: { messageID: "sms_wired" } });
    });
    const senders = otpSendersFromConfig(
      {
        email: {
          transport: "resend",
          apiKey: RESEND_API_KEY,
          fromEmail: FROM_EMAIL,
          fromName: FROM_NAME,
        },
        sms: {
          transport: "sms-fly",
          apiKey: SMS_FLY_API_KEY,
          apiUrl: SMS_FLY_API_URL,
          sender: SENDER,
        },
      },
      { logger, fetch: http.fetch },
    );

    await senders.sendPhoneOtp({ phoneNumber: PHONE, code: CODE });
    await senders.sendEmailOtp({
      email: EMAIL,
      otp: CODE,
      type: "sign-in",
    });

    expect(http.calls.map((call) => call.url)).toEqual([
      SMS_FLY_API_URL,
      RESEND_EMAILS_URL,
    ]);
  });
});

describe("e164Digits", () => {
  it("strips + from E.164 and rejects guessed local numbers", () => {
    expect(e164Digits(PHONE)).toBe("380501234567");
    expect(() => e164Digits("0501234567")).toThrow(OtpVendorSendError);
    expect(() => e164Digits("+380 501234567")).toThrow(OtpVendorSendError);
  });
});
