/**
 * Process logger factory — pino with the shared redaction policy
 * (fnd-T28, security-operations §6). Every API/worker logger goes through
 * this function so a raw `pino()` cannot skip the walker.
 */
import { pino, type DestinationStream, type Logger } from "pino";

import { LOG_REDACT_PATHS, REDACTED, redactUnknown } from "./redact.js";

export interface ProcessLoggerOptions {
  readonly name: string;
  readonly destination?: DestinationStream;
}

export function createProcessLogger(options: ProcessLoggerOptions): Logger {
  return pino(
    {
      name: options.name,
      redact: { paths: [...LOG_REDACT_PATHS], censor: REDACTED },
      hooks: {
        logMethod(args, method) {
          const redacted = args.map((arg) => redactUnknown(arg));
          method.apply(this, redacted as Parameters<typeof method>);
        },
      },
    },
    options.destination,
  );
}
