import { describe, expect, it } from "vitest";

import {
  RENDER_PDF_EVENT_NAME,
  renderPdfContract,
  renderPdfInputSchema,
} from "./render-pdf.contract.js";

const validId = "11111111-1111-4111-8111-111111111111";

const envelope = {
  eventId: validId,
  name: RENDER_PDF_EVENT_NAME,
  version: 1,
  occurredAt: "2026-03-15T12:00:00.000Z",
  companyId: validId,
  aggregate: { type: "document", id: validId, sequence: "1" },
  actor: { type: "user" as const, id: validId, channel: "ui" as const },
  requestId: validId,
  correlationId: validId,
  causationId: validId,
  payload: {
    documentId: validId,
    orderId: validId,
    type: "payment_invoice" as const,
    documentNumber: "KA-РХ-000001",
  },
};

describe("docGeneration.renderPdf contract", () => {
  it("is a tenant system internal write, audited, and idempotent", () => {
    expect(renderPdfContract.name).toBe("docGeneration.renderPdf");
    expect(renderPdfContract.principal).toBe("system");
    expect(renderPdfContract.systemScope).toBe("tenant");
    expect(renderPdfContract.transport).toBe("internal");
    expect(renderPdfContract.risk).toBe("write");
    expect(renderPdfContract.permissions).toEqual([]);
    expect(renderPdfContract.aiExposure).toBe("internal");
    expect(renderPdfContract.audit).toBe(true);
    expect(renderPdfContract.idempotent).toBe(true);
    expect(renderPdfContract.emits).toEqual([]);
    expect(renderPdfContract.atomicCalls).toEqual([
      "files.recordGeneratedObject",
    ]);
    expect(renderPdfContract.atomicCallers).toEqual([]);
    expect(renderPdfContract.timeout).toBe(30_000);
  });

  it("accepts a documents.created envelope and rejects other event names", () => {
    expect(renderPdfInputSchema.parse(envelope).name).toBe("documents.created");
    expect(
      renderPdfInputSchema.safeParse({ ...envelope, name: "orders.created" })
        .success,
    ).toBe(false);
  });
});
