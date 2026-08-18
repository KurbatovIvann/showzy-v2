import { describe, expect, it } from "vitest";

import { createProcessLogger } from "./logger.js";
import { REDACTED } from "./redact.js";

const OTP = "847291";
const DB_PASSWORD = "DB_PASSWORD_SENTINEL";

function captureLogger(name = "test"): {
  logger: ReturnType<typeof createProcessLogger>;
  entries: () => Record<string, unknown>[];
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
    entries: () =>
      lines
        .flatMap((chunk) => chunk.split("\n"))
        .filter((line) => line !== "")
        .map((line) => JSON.parse(line) as Record<string, unknown>),
  };
}

describe("createProcessLogger", () => {
  it("never writes OTP, secrets, or connection passwords to the log sink", () => {
    const { logger, entries } = captureLogger();
    logger.info(
      {
        request_id: "req-1",
        action: "account.requestOtp",
        otp: OTP,
        databaseUrl: `postgresql://showzy:${DB_PASSWORD}@localhost:5432/showzy`,
      },
      `otp ${OTP} postgresql://showzy:${DB_PASSWORD}@localhost:5432/showzy`,
    );

    const [entry] = entries();
    expect(entry).toBeDefined();
    expect(entry?.["request_id"]).toBe("req-1");
    expect(entry?.["action"]).toBe("account.requestOtp");
    expect(entry?.["otp"]).toBe(REDACTED);
    expect(JSON.stringify(entry)).not.toContain(OTP);
    expect(JSON.stringify(entry)).not.toContain(DB_PASSWORD);
  });

  it("redacts credentials inside Error messages sent to Sentry-bound logs", () => {
    const { logger, entries } = captureLogger();
    logger.error(
      new Error(`postgresql://showzy:${DB_PASSWORD}@localhost:5432/showzy`),
    );
    expect(JSON.stringify(entries())).not.toContain(DB_PASSWORD);
  });
});
