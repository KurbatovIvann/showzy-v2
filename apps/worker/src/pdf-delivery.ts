/**
 * Narrow outbox integration for SHO-436: when `docGeneration.pdf-renderer`
 * exhausts the existing delivery retry budget, persist a durable failed
 * job via `docGeneration.markFailed` in a **separate** executeAction so
 * the mark cannot roll back with the thrown render. Production PDF retry
 * is this outbox path (five attempts, 1s/2s/4s/8s). The BullMQ `pdf`
 * processor does not enqueue durable one-shot work (db.md §6).
 */
import { randomUUID } from "node:crypto";

import {
  executeAction,
  type ActionPipelineDeps,
  type ClaimableDelivery,
  type DeliveryOutcome,
} from "@showzy/core";
import { markFailed } from "@showzy/doc-generation";
import { readPdfRetryScope } from "@showzy/doc-generation/pdf-retry";
import { PDF_RENDERER_CONSUMER } from "@showzy/doc-generation/subscriptions";
import type { Logger } from "pino";

export async function maybeFinalizeDeadPdfGeneration(env: {
  readonly pipeline: ActionPipelineDeps;
  readonly delivery: ClaimableDelivery;
  readonly outcome: DeliveryOutcome;
  readonly logger: Logger;
  readonly workerId: string;
}): Promise<void> {
  if (env.delivery.consumer !== PDF_RENDERER_CONSUMER) {
    return;
  }
  if (env.outcome.status !== "failed" || env.outcome.retryAt !== null) {
    return;
  }
  const scope = readPdfRetryScope(env.outcome.error);
  if (scope === undefined) {
    env.logger.error(
      {
        worker_id: env.workerId,
        consumer: env.delivery.consumer,
        event_id: env.delivery.eventId,
        error_code: env.outcome.error.code,
      },
      "pdf delivery dead-lettered without document scope; replay-dead-deliveries recovers",
    );
    return;
  }
  try {
    await executeAction(env.pipeline, {
      action: markFailed,
      input: { documentId: scope.documentId },
      request: {
        requestId: randomUUID(),
        correlationId: randomUUID(),
        channel: "system",
        idempotencyKey: `docGeneration.markFailed:${env.delivery.eventId}`,
      },
      principal: {
        mode: "system",
        serviceName: PDF_RENDERER_CONSUMER,
        scope: { scope: "tenant", companyId: scope.companyId },
      },
    });
  } catch (error) {
    env.logger.error(
      {
        worker_id: env.workerId,
        consumer: env.delivery.consumer,
        event_id: env.delivery.eventId,
        document_id: scope.documentId,
        err: error,
      },
      "pdf failure bookkeeping failed; replay-dead-deliveries recovers",
    );
  }
}
