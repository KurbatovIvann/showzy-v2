/**
 * Process shutdown latch. SIGINT and SIGTERM can race while in-flight
 * requests drain; a second `close()` would `pool.end()` a closed pool
 * and reject unhandled. One latch, one close, then Sentry flush.
 *
 * Copied from `apps/worker/src/shutdown.ts` (SHO-293). App-process
 * concern — do not import the worker package.
 */
import type { Logger } from "pino";

export interface ProcessShutdown {
  run(): Promise<void>;
}

export interface CreateProcessShutdownOptions {
  close(): Promise<void>;
  flush(): Promise<void>;
  readonly logger: Logger;
}

export function createProcessShutdown(
  options: CreateProcessShutdownOptions,
): ProcessShutdown {
  let closing = false;

  return {
    async run() {
      if (closing) {
        options.logger.warn("api shutdown already in progress");
        return;
      }
      closing = true;
      try {
        await options.close();
      } catch (error) {
        options.logger.error({ err: error }, "api close failed");
      }
      try {
        await options.flush();
      } catch (error) {
        options.logger.error({ err: error }, "sentry flush failed");
      }
    },
  };
}
