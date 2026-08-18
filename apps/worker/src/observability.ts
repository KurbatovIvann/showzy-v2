/**
 * Process observability for the worker (fnd-T28). Keep in lockstep with
 * `apps/api/src/observability.ts`.
 */
import * as Sentry from "@sentry/node";
import {
  createErrorTelemetry,
  createProcessLogger,
  redactUnknown,
  scrubTelemetryEvent,
} from "@showzy/config";
import type { ActionTelemetry } from "@showzy/core";
import type { Logger } from "pino";

export interface ProcessObservability {
  readonly logger: Logger;
  readonly telemetry: ActionTelemetry;
}

/** Best-effort Sentry drain on process shutdown (no-op when DSN is unset). */
export async function flushProcessObservability(
  timeoutMs = 2_000,
): Promise<void> {
  await Sentry.flush(timeoutMs);
}

export function createProcessObservability(options: {
  readonly name: string;
  readonly sentryDsn: string | undefined;
}): ProcessObservability {
  if (options.sentryDsn !== undefined) {
    Sentry.init({
      dsn: options.sentryDsn,
      sendDefaultPii: false,
      beforeSend(event) {
        return scrubTelemetryEvent(event);
      },
    });
  }

  return {
    logger: createProcessLogger({ name: options.name }),
    telemetry: createErrorTelemetry({
      captureException(error, tags) {
        Sentry.withScope((scope) => {
          for (const [key, value] of Object.entries(tags)) {
            scope.setTag(key, value);
          }
          Sentry.captureException(redactUnknown(error));
        });
      },
    }),
  };
}
