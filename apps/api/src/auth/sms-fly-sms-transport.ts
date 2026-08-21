/**
 * Live SMS Fly `SENDMESSAGE` adapter (auth-T2). Recipient is E.164 without `+`.
 * Timeouts, redirects, HTTP errors, and `success: 0` fail the better-auth send.
 */
import {
  OTP_VENDOR_TIMEOUT_MS,
  OtpVendorSendError,
  SMS_FLY_TTL_SECONDS,
  drainBody,
  e164Digits,
  maskPhone,
  readJsonObject,
  throwVendorFetchFailure,
  vendorFetch,
  type OtpTransportRuntime,
  type OtpVendorLogger,
} from "./otp-vendor.js";

export function createSmsFlySmsTransport(options: {
  readonly apiKey: string;
  readonly apiUrl: string;
  readonly sender: string;
  readonly logger: OtpVendorLogger;
  readonly fetch?: OtpTransportRuntime["fetch"];
  readonly timeoutMs?: OtpTransportRuntime["timeoutMs"];
}): {
  send(input: { to: string; text: string }): Promise<void>;
} {
  const fetchImpl = options.fetch ?? vendorFetch();
  const timeoutMs = options.timeoutMs ?? OTP_VENDOR_TIMEOUT_MS;

  return {
    async send({ to, text }) {
      const recipientDigits = e164Digits(to);
      // Mask before logging. Field name is `recipient` so pino key-redaction
      // does not replace the card-allowed mask with `[Redacted]`.
      const recipient = maskPhone(to);
      let response: Response;
      try {
        response = await fetchImpl(options.apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            auth: { key: options.apiKey },
            action: "SENDMESSAGE",
            data: {
              recipient: recipientDigits,
              channels: ["sms"],
              sms: {
                source: options.sender,
                ttl: SMS_FLY_TTL_SECONDS,
                text,
              },
            },
          }),
          signal: AbortSignal.timeout(timeoutMs),
          redirect: "error",
        });
      } catch (error) {
        options.logger.error(
          { vendor: "sms-fly", recipient },
          "OTP SMS send failed",
        );
        throwVendorFetchFailure("SMS Fly", error);
      }

      if (!response.ok) {
        await drainBody(response);
        options.logger.error(
          { vendor: "sms-fly", recipient, status: response.status },
          "OTP SMS send failed",
        );
        throw new OtpVendorSendError(
          `SMS Fly request failed with status ${String(response.status)}`,
        );
      }

      let payload: Record<string, unknown>;
      try {
        payload = await readJsonObject(response, "SMS Fly");
      } catch (error) {
        options.logger.error(
          { vendor: "sms-fly", recipient },
          "OTP SMS send failed",
        );
        throw error;
      }

      if (payload["success"] !== 1) {
        const vendorErrorCode = vendorErrorCodeOf(payload);
        options.logger.error(
          { vendor: "sms-fly", recipient, vendorErrorCode },
          "OTP SMS send failed",
        );
        throw new OtpVendorSendError(
          "SMS Fly returned an unsuccessful payload",
        );
      }

      const data = payload["data"];
      const vendorMessageId =
        data !== null &&
        typeof data === "object" &&
        !Array.isArray(data) &&
        "messageID" in data &&
        typeof data.messageID === "string"
          ? data.messageID
          : undefined;
      if (vendorMessageId === undefined) {
        options.logger.error(
          { vendor: "sms-fly", recipient },
          "OTP SMS send failed",
        );
        throw new OtpVendorSendError(
          "SMS Fly returned an unsuccessful payload",
        );
      }

      options.logger.info(
        { vendor: "sms-fly", recipient, vendorMessageId },
        "OTP SMS sent",
      );
    },
  };
}

function vendorErrorCodeOf(
  payload: Record<string, unknown>,
): string | undefined {
  const error = payload["error"];
  if (error === null || typeof error !== "object" || Array.isArray(error)) {
    return undefined;
  }
  if (!("code" in error) || typeof error.code !== "string") {
    return undefined;
  }
  return error.code;
}
