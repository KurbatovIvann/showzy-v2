import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { ActionPipelineDeps, ClaimableDelivery } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";
import { PdfGenerationRetryableError } from "@showzy/doc-generation/pdf-retry";
import { PDF_RENDERER_CONSUMER } from "@showzy/doc-generation/subscriptions";
import { pino, type Logger } from "pino";
import { describe, expect, it } from "vitest";

import { maybeFinalizeDeadPdfGeneration } from "./pdf-delivery.js";

const documentId = "11111111-1111-4111-8111-111111111111";
const companyId = "22222222-2222-4222-8222-222222222222";
const eventId = randomUUID();

function captureLogger(): {
  logger: Logger;
  entries: () => Record<string, unknown>[];
} {
  const lines: string[] = [];
  const logger = pino(
    { base: null },
    {
      write(chunk: string) {
        lines.push(chunk);
      },
    },
  );
  return {
    logger,
    entries: () =>
      lines
        .flatMap((chunk) => chunk.split("\n"))
        .filter((line) => line !== "")
        .map((line) => JSON.parse(line) as Record<string, unknown>),
  };
}

function unusedPipeline(logger: Logger): ActionPipelineDeps {
  return {
    get db(): ActionPipelineDeps["db"] {
      throw new Error("pipeline db should not be used");
    },
    logger,
  };
}

function pdfDelivery(consumer = PDF_RENDERER_CONSUMER): ClaimableDelivery {
  return {
    consumer,
    eventId,
    eventName: "documents.created",
  };
}

describe("maybeFinalizeDeadPdfGeneration", () => {
  it("skips non-pdf consumers and in-budget retries", async () => {
    const captured = captureLogger();
    const pipeline = unusedPipeline(captured.logger);
    await maybeFinalizeDeadPdfGeneration({
      pipeline,
      delivery: pdfDelivery("chat.order-card-updater"),
      outcome: {
        status: "failed",
        error: new CoreInvariantError("other consumer"),
        retryAt: null,
      },
      logger: captured.logger,
      workerId: "w1",
    });
    await maybeFinalizeDeadPdfGeneration({
      pipeline,
      delivery: pdfDelivery(),
      outcome: {
        status: "failed",
        error: new PdfGenerationRetryableError({
          documentId,
          companyId,
          reason: "Error: injected",
        }),
        retryAt: new Date().toISOString(),
      },
      logger: captured.logger,
      workerId: "w1",
    });
    expect(captured.entries()).toEqual([]);
  });

  it("logs a defined recovery path when dead-lettered without document scope", async () => {
    const captured = captureLogger();
    await maybeFinalizeDeadPdfGeneration({
      pipeline: unusedPipeline(captured.logger),
      delivery: pdfDelivery(),
      outcome: {
        status: "failed",
        error: new CoreInvariantError("claim failed"),
        retryAt: null,
      },
      logger: captured.logger,
      workerId: "w1",
    });
    expect(captured.entries()).toEqual([
      expect.objectContaining({
        msg: "pdf delivery dead-lettered without document scope; replay-dead-deliveries recovers",
        consumer: PDF_RENDERER_CONSUMER,
        event_id: eventId,
        error_code: "INTERNAL",
      }),
    ]);
  });

  it("logs bookkeeping failure without signed URLs when markFailed cannot run", async () => {
    const captured = captureLogger();
    await maybeFinalizeDeadPdfGeneration({
      pipeline: unusedPipeline(captured.logger),
      delivery: pdfDelivery(),
      outcome: {
        status: "failed",
        error: new PdfGenerationRetryableError({
          documentId,
          companyId,
          reason: "Error: injected storage outage",
        }),
        retryAt: null,
      },
      logger: captured.logger,
      workerId: "w1",
    });
    const entries = captured.entries();
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          msg: "pdf failure bookkeeping failed; replay-dead-deliveries recovers",
          document_id: documentId,
          event_id: eventId,
        }),
      ]),
    );
    expect(JSON.stringify(entries)).not.toContain("https://");
    expect(JSON.stringify(entries)).not.toContain("X-Amz-");
  });
});

describe("pdf delivery source", () => {
  it("finalizes through executeAction(markFailed) without domain SQL", () => {
    const directory = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(join(directory, "pdf-delivery.ts"), "utf8");
    const loop = readFileSync(join(directory, "loop.ts"), "utf8");
    expect(loop).toContain("maybeFinalizeDeadPdfGeneration");
    expect(source).toContain("executeAction");
    expect(source).toContain("markFailed");
    expect(source).toContain("replay-dead-deliveries");
    expect(source).not.toContain("documentGenerationJobs");
    expect(source).not.toContain("@showzy/db/schema/");
    expect(source).not.toContain("drizzle-orm");
  });
});
