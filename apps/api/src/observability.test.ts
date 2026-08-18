import { createProcessLogger, scrubTelemetryEvent } from "@showzy/config";
import { describe, expect, it } from "vitest";

const OTP = "847291";
const DB_PASSWORD = "DB_PASSWORD_SENTINEL";
const BEARER = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.sentinel";

describe("API process log/Sentry redaction", () => {
  it("the process logger never writes OTP or connection passwords", () => {
    const lines: string[] = [];
    const logger = createProcessLogger({
      name: "api-redaction-test",
      destination: {
        write(chunk: string) {
          lines.push(chunk);
        },
      },
    });
    logger.info(
      {
        otp: OTP,
        databaseUrl: `postgresql://showzy:${DB_PASSWORD}@localhost:5432/showzy`,
      },
      "boot",
    );
    const payload = lines.join("\n");
    expect(payload).not.toContain(OTP);
    expect(payload).not.toContain(DB_PASSWORD);
  });

  it("Sentry beforeSend scrubbing drops tokens from a request payload", () => {
    const event = scrubTelemetryEvent({
      extra: { otp: OTP },
      request: { headers: { authorization: `Bearer ${BEARER}` } },
    });
    expect(JSON.stringify(event)).not.toContain(OTP);
    expect(JSON.stringify(event)).not.toContain(BEARER);
  });
});
