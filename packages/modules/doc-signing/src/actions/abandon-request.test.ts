import { describe, expect, it } from "vitest";

import {
  ABANDON_REQUEST_EVENT_NAME,
  abandonRequestContract,
  abandonRequestInputSchema,
} from "./abandon-request.contract.js";

const validId = "11111111-1111-4111-8111-111111111111";

const envelope = {
  eventId: validId,
  name: ABANDON_REQUEST_EVENT_NAME,
  version: 1,
  occurredAt: "2026-08-30T12:00:00.000Z",
  companyId: validId,
  aggregate: { type: "document", id: validId, sequence: "1" },
  actor: { type: "user" as const, id: validId, channel: "ui" as const },
  requestId: validId,
  correlationId: validId,
  causationId: validId,
  payload: { documentId: validId, orderId: validId },
};

describe("docSigning.abandonRequest contract", () => {
  it("is a tenant system internal write, audited, and delivery-idempotent", () => {
    expect(abandonRequestContract.name).toBe("docSigning.abandonRequest");
    expect(abandonRequestContract.principal).toBe("system");
    expect(abandonRequestContract.systemScope).toBe("tenant");
    expect(abandonRequestContract.transport).toBe("internal");
    expect(abandonRequestContract.risk).toBe("write");
    expect(abandonRequestContract.permissions).toEqual([]);
    expect(abandonRequestContract.aiExposure).toBe("internal");
    expect(abandonRequestContract.audit).toBe(true);
    expect(abandonRequestContract.idempotent).toBe(true);
    expect(abandonRequestContract.emits).toEqual([]);
    expect(abandonRequestContract.timeout).toBe(10_000);
    expect(ABANDON_REQUEST_EVENT_NAME).toBe("documents.cancelled");
  });

  it("accepts a cancelled envelope and does not treat companyId as a grant field", () => {
    expect(abandonRequestInputSchema.parse(envelope)).toEqual(envelope);
    expect(
      abandonRequestInputSchema.safeParse({
        ...envelope,
        name: "documents.created",
      }).success,
    ).toBe(false);
  });
});
