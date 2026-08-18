/**
 * Action-pipeline telemetry seam filled by the apps with Sentry
 * (fnd-T28). Core stays dependency-free; this helper is structurally
 * compatible with `@showzy/core`'s `ActionTelemetry` without importing it.
 *
 * Errors are flushed on `end` so actor/company tags from the finish line
 * are included. `captureException` is injected — tests assert tags
 * without talking to Sentry.
 */

export interface ErrorTelemetryFields {
  readonly requestId: string;
  readonly correlationId: string;
  readonly action: string;
  readonly channel: string;
  readonly aiTraceId?: string;
  readonly toolCallId?: string;
}

export interface ErrorTelemetryOutcome {
  readonly outcome: string;
  readonly actorType: string | null;
  readonly actorId: string | null;
  readonly companyId: string | null;
  readonly durationMs: number;
}

export interface ErrorTelemetry {
  startSpan(fields: ErrorTelemetryFields): {
    recordError(error: unknown): void;
    end(outcome: ErrorTelemetryOutcome): void;
  };
}

export interface ErrorTelemetryOptions {
  readonly captureException: (
    error: unknown,
    tags: Readonly<Record<string, string>>,
  ) => void;
}

function compactTags(
  entries: ReadonlyArray<readonly [string, string | null | undefined]>,
): Record<string, string> {
  const tags: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (value !== undefined && value !== null && value !== "") {
      tags[key] = value;
    }
  }
  return tags;
}

export function createErrorTelemetry(
  options: ErrorTelemetryOptions,
): ErrorTelemetry {
  return {
    startSpan(fields) {
      const errors: unknown[] = [];
      return {
        recordError(error) {
          errors.push(error);
        },
        end(outcome) {
          const tags = compactTags([
            ["request_id", fields.requestId],
            ["correlation_id", fields.correlationId],
            ["action", fields.action],
            ["channel", fields.channel],
            ["ai_trace_id", fields.aiTraceId],
            ["tool_call_id", fields.toolCallId],
            ["outcome", outcome.outcome],
            ["actor_type", outcome.actorType],
            ["actor_id", outcome.actorId],
            ["company_id", outcome.companyId],
          ]);
          for (const error of errors) {
            options.captureException(error, tags);
          }
        },
      };
    },
  };
}
