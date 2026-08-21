/**
 * Live Resend `emails.send` adapter (auth-T2). `fetch` only — no `resend` SDK.
 * Timeouts, redirects, and non-2xx fail the better-auth send.
 */
import {
  OTP_VENDOR_TIMEOUT_MS,
  OtpVendorSendError,
  RESEND_EMAILS_URL,
  drainBody,
  maskEmail,
  readJsonObject,
  throwVendorFetchFailure,
  vendorFetch,
  type OtpTransportRuntime,
  type OtpVendorLogger,
} from "./otp-vendor.js";

export function createResendEmailTransport(options: {
  readonly apiKey: string;
  readonly fromEmail: string;
  readonly fromName: string;
  readonly logger: OtpVendorLogger;
  readonly fetch?: OtpTransportRuntime["fetch"];
  readonly timeoutMs?: OtpTransportRuntime["timeoutMs"];
}): {
  send(input: { to: string; subject: string; html: string }): Promise<void>;
} {
  const fetchImpl = options.fetch ?? vendorFetch();
  const timeoutMs = options.timeoutMs ?? OTP_VENDOR_TIMEOUT_MS;

  return {
    async send({ to, subject, html }) {
      // Mask before logging. Field name is `recipient` so pino key-redaction
      // does not replace the card-allowed mask with `[Redacted]`.
      const recipient = maskEmail(to);
      let response: Response;
      try {
        response = await fetchImpl(RESEND_EMAILS_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${options.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${options.fromName} <${options.fromEmail}>`,
            to,
            subject,
            html,
          }),
          signal: AbortSignal.timeout(timeoutMs),
          redirect: "error",
        });
      } catch (error) {
        options.logger.error(
          { vendor: "resend", recipient },
          "OTP email send failed",
        );
        throwVendorFetchFailure("Resend", error);
      }

      if (!response.ok) {
        await drainBody(response);
        options.logger.error(
          { vendor: "resend", recipient, status: response.status },
          "OTP email send failed",
        );
        throw new OtpVendorSendError(
          `Resend request failed with status ${String(response.status)}`,
        );
      }

      let payload: Record<string, unknown>;
      try {
        payload = await readJsonObject(response, "Resend");
      } catch (error) {
        options.logger.error(
          { vendor: "resend", recipient },
          "OTP email send failed",
        );
        throw error;
      }

      const vendorMessageId =
        typeof payload["id"] === "string" ? payload["id"] : undefined;
      if (vendorMessageId === undefined) {
        options.logger.error(
          { vendor: "resend", recipient },
          "OTP email send failed",
        );
        throw new OtpVendorSendError("Resend returned an unsuccessful payload");
      }

      options.logger.info(
        { vendor: "resend", recipient, vendorMessageId },
        "OTP email sent",
      );
    },
  };
}
