import { describe, expect, it } from "vitest";

import { createErrorTelemetry } from "./telemetry.js";

describe("createErrorTelemetry", () => {
  it("captures recorded errors on end with snake_case correlation tags", () => {
    const captured: {
      error: unknown;
      tags: Readonly<Record<string, string>>;
    }[] = [];
    const telemetry = createErrorTelemetry({
      captureException(error, tags) {
        captured.push({ error, tags });
      },
    });

    const span = telemetry.startSpan({
      requestId: "req-1",
      correlationId: "corr-1",
      action: "orders.create",
      channel: "ui",
    });
    const failure = new Error("boom");
    span.recordError(failure);
    span.end({
      outcome: "INTERNAL",
      actorType: "user",
      actorId: "user-1",
      companyId: "company-1",
      durationMs: 12,
    });

    expect(captured).toHaveLength(1);
    expect(captured[0]?.error).toBe(failure);
    expect(captured[0]?.tags).toEqual({
      request_id: "req-1",
      correlation_id: "corr-1",
      action: "orders.create",
      channel: "ui",
      outcome: "INTERNAL",
      actor_type: "user",
      actor_id: "user-1",
      company_id: "company-1",
    });
  });

  it("does not capture on a successful span", () => {
    const captured: unknown[] = [];
    const telemetry = createErrorTelemetry({
      captureException(error) {
        captured.push(error);
      },
    });
    telemetry
      .startSpan({
        requestId: "req-2",
        correlationId: "corr-2",
        action: "orders.get",
        channel: "ui",
      })
      .end({
        outcome: "ok",
        actorType: "user",
        actorId: "user-1",
        companyId: "company-1",
        durationMs: 4,
      });
    expect(captured).toEqual([]);
  });
});
