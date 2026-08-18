/**
 * Process shutdown latch (fnd-G1 A9). SIGINT and SIGTERM can race while
 * the loop is draining; a second `close()` would `pool.end()` a closed
 * pool and reject unhandled. One latch, one close, then Sentry flush.
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
        options.logger.warn("worker shutdown already in progress");
        return;
      }
      closing = true;
      try {
        await options.close();
      } catch (error) {
        options.logger.error({ err: error }, "worker close failed");
      }
      try {
        await options.flush();
      } catch (error) {
        options.logger.error({ err: error }, "sentry flush failed");
      }
    },
  };
}
