/**
 * Dedicated Postgres client for `LISTEN domain_events` (db.md §4,
 * ADR-0012). LISTEN is connection-scoped, so this must not share the
 * Drizzle pool. Polling remains the fallback if this connection drops.
 */
import type { Logger } from "pino";
import pg from "pg";

import { OUTBOX_NOTIFY_CHANNEL } from "./policy.js";

export interface OutboxListener {
  start(onNotify: () => void): Promise<void>;
  stop(): Promise<void>;
}

export interface CreateOutboxListenerOptions {
  readonly connectionString: string;
  readonly logger: Logger;
}

export function createOutboxListener(
  options: CreateOutboxListenerOptions,
): OutboxListener {
  const client = new pg.Client({ connectionString: options.connectionString });
  let onNotify: (() => void) | undefined;
  let connected = false;
  let stopped = false;

  client.on("notification", (message: pg.Notification) => {
    if (stopped || message.channel !== OUTBOX_NOTIFY_CHANNEL) {
      return;
    }
    onNotify?.();
  });
  client.on("error", (error: Error) => {
    options.logger.error(
      { err: error, channel: OUTBOX_NOTIFY_CHANNEL },
      "outbox listen connection error",
    );
  });

  return {
    async start(handler) {
      if (stopped) {
        return;
      }
      onNotify = handler;
      await client.connect();
      connected = true;
      await client.query(`LISTEN ${OUTBOX_NOTIFY_CHANNEL}`);
    },
    async stop() {
      stopped = true;
      onNotify = undefined;
      if (!connected) {
        return;
      }
      connected = false;
      try {
        await client.query(`UNLISTEN ${OUTBOX_NOTIFY_CHANNEL}`);
      } catch {
        // `client.end()` drops LISTEN state even if UNLISTEN fails.
      }
      await client.end();
    },
  };
}
