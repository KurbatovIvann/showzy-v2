/**
 * Dedicated Postgres client for `LISTEN domain_events` (db.md §4,
 * ADR-0012). LISTEN is connection-scoped, so this must not share the
 * Drizzle pool. Polling remains the fallback if this connection drops;
 * a dropped client is reconnected with backoff and a periodic
 * "outbox listen down, poll-only" heartbeat while degraded (A9).
 */
import type { Logger } from "pino";
import pg from "pg";

import {
  LISTEN_DOWN_HEARTBEAT_MS,
  LISTEN_RECONNECT_MAX_MS,
  LISTEN_RECONNECT_MIN_MS,
  OUTBOX_NOTIFY_CHANNEL,
} from "./policy.js";

export interface OutboxListener {
  start(onNotify: () => void): Promise<void>;
  stop(): Promise<void>;
}

/** Minimal pg.Client surface the listener needs — injected in tests. */
export interface ListenClient {
  connect(): Promise<unknown>;
  query(sql: string): Promise<unknown>;
  end(): Promise<unknown>;
  onNotification(
    listener: (message: { readonly channel: string }) => void,
  ): void;
  onError(listener: (error: Error) => void): void;
}

export interface CreateOutboxListenerOptions {
  readonly connectionString: string;
  readonly logger: Logger;
  createClient?: () => ListenClient;
  delay?: (ms: number, signal: AbortSignal) => Promise<void>;
  now?: () => number;
  readonly reconnectMinMs?: number;
  readonly reconnectMaxMs?: number;
  readonly downHeartbeatMs?: number;
}

function wrapPgClient(client: pg.Client): ListenClient {
  return {
    connect: () => client.connect(),
    query: (sql) => client.query(sql),
    end: () => client.end(),
    onNotification(listener) {
      client.on("notification", listener);
    },
    onError(listener) {
      client.on("error", listener);
    },
  };
}

function defaultDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

export function createOutboxListener(
  options: CreateOutboxListenerOptions,
): OutboxListener {
  const reconnectMinMs = options.reconnectMinMs ?? LISTEN_RECONNECT_MIN_MS;
  const reconnectMaxMs = options.reconnectMaxMs ?? LISTEN_RECONNECT_MAX_MS;
  const downHeartbeatMs = options.downHeartbeatMs ?? LISTEN_DOWN_HEARTBEAT_MS;
  const now = options.now ?? Date.now;
  const delay = options.delay ?? defaultDelay;
  const createClient =
    options.createClient ??
    (() =>
      wrapPgClient(
        new pg.Client({ connectionString: options.connectionString }),
      ));

  let client: ListenClient | undefined;
  let onNotify: (() => void) | undefined;
  let listenUp = false;
  let stopped = false;
  let reconnecting = false;
  let downSinceMs: number | undefined;
  let lastHeartbeatMs = 0;
  const abort = new AbortController();

  function isStopped(): boolean {
    return stopped;
  }

  function isListenUp(): boolean {
    return listenUp;
  }

  function attach(next: ListenClient): void {
    next.onNotification((message) => {
      if (stopped || next !== client) {
        return;
      }
      if (message.channel !== OUTBOX_NOTIFY_CHANNEL) {
        return;
      }
      onNotify?.();
    });
    next.onError((error) => {
      if (stopped || next !== client) {
        return;
      }
      options.logger.error(
        { err: error, channel: OUTBOX_NOTIFY_CHANNEL },
        "outbox listen connection error",
      );
      markDown();
      void reconnect();
    });
  }

  function markDown(): void {
    listenUp = false;
    if (downSinceMs === undefined) {
      downSinceMs = now();
    }
  }

  function emitDownHeartbeat(): void {
    const nowMs = now();
    if (lastHeartbeatMs !== 0 && nowMs - lastHeartbeatMs < downHeartbeatMs) {
      return;
    }
    lastHeartbeatMs = nowMs;
    options.logger.error(
      {
        channel: OUTBOX_NOTIFY_CHANNEL,
        down_ms: downSinceMs === undefined ? 0 : nowMs - downSinceMs,
      },
      "outbox listen down, poll-only",
    );
  }

  async function connectFresh(): Promise<void> {
    const next = createClient();
    attach(next);
    try {
      await next.connect();
      await next.query(`LISTEN ${OUTBOX_NOTIFY_CHANNEL}`);
    } catch (error) {
      try {
        await next.end();
      } catch {
        // Connect failed; dropping the unused client is best-effort.
      }
      throw error;
    }
    const previous = client;
    client = next;
    listenUp = true;
    if (downSinceMs !== undefined) {
      options.logger.info(
        {
          channel: OUTBOX_NOTIFY_CHANNEL,
          down_ms: now() - downSinceMs,
        },
        "outbox listen recovered",
      );
      downSinceMs = undefined;
      lastHeartbeatMs = 0;
    }
    if (previous !== undefined && previous !== next) {
      try {
        await previous.end();
      } catch {
        // The previous client is already dead; the replacement is listening.
      }
    }
  }

  async function reconnect(): Promise<void> {
    if (stopped || reconnecting) {
      return;
    }
    reconnecting = true;
    let backoffMs = reconnectMinMs;
    try {
      while (!isListenUp()) {
        if (isStopped()) {
          break;
        }
        emitDownHeartbeat();
        try {
          await connectFresh();
          backoffMs = reconnectMinMs;
        } catch (error) {
          options.logger.error(
            {
              err: error,
              channel: OUTBOX_NOTIFY_CHANNEL,
              reconnect_in_ms: backoffMs,
            },
            "outbox listen reconnect failed",
          );
          await delay(backoffMs, abort.signal);
          backoffMs = Math.min(reconnectMaxMs, backoffMs * 2);
        }
      }
    } finally {
      reconnecting = false;
    }
  }

  return {
    async start(handler) {
      if (stopped) {
        return;
      }
      onNotify = handler;
      await connectFresh();
    },
    async stop() {
      stopped = true;
      onNotify = undefined;
      abort.abort();
      const current = client;
      client = undefined;
      listenUp = false;
      if (current === undefined) {
        return;
      }
      try {
        await current.query(`UNLISTEN ${OUTBOX_NOTIFY_CHANNEL}`);
      } catch {
        // `end()` drops LISTEN state even if UNLISTEN fails.
      }
      try {
        await current.end();
      } catch {
        // Already closed after a dropped connection.
      }
    },
  };
}
