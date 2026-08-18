import { pino, type Logger } from "pino";
import { describe, expect, it } from "vitest";

import { createOutboxListener, type ListenClient } from "./listen.js";
import { OUTBOX_NOTIFY_CHANNEL } from "./policy.js";

function capturingLogger(): {
  logger: Logger;
  messages: () => string[];
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
    messages: () =>
      lines
        .flatMap((chunk) => chunk.split("\n"))
        .filter((line) => line !== "")
        .map((line) => (JSON.parse(line) as { msg: string }).msg),
  };
}

interface FakeClient extends ListenClient {
  emitError(error: Error): void;
  emitNotify(): void;
}

function createFakeBroker(): {
  createClient: () => ListenClient;
  clients: () => FakeClient[];
  failConnectAt: (index: number) => void;
} {
  const clients: FakeClient[] = [];
  const failAt = new Set<number>();

  return {
    clients: () => clients,
    failConnectAt(index) {
      failAt.add(index);
    },
    createClient() {
      let notification: ((message: { channel: string }) => void) | undefined;
      let errorHandler: ((error: Error) => void) | undefined;
      const client: FakeClient = {
        connect() {
          if (failAt.has(clients.length - 1)) {
            return Promise.reject(new Error("connect refused"));
          }
          return Promise.resolve();
        },
        query() {
          return Promise.resolve(undefined);
        },
        end() {
          return Promise.resolve();
        },
        onNotification(listener) {
          notification = listener;
        },
        onError(listener) {
          errorHandler = listener;
        },
        emitError(error) {
          errorHandler?.(error);
        },
        emitNotify() {
          notification?.({ channel: OUTBOX_NOTIFY_CHANNEL });
        },
      };
      clients.push(client);
      return client;
    },
  };
}

function createControllableDelay(): {
  delay: (ms: number, signal: AbortSignal) => Promise<void>;
  flush: () => void;
} {
  const pending: Array<() => void> = [];
  return {
    delay(_ms, signal) {
      return new Promise((resolve) => {
        if (signal.aborted) {
          resolve();
          return;
        }
        pending.push(resolve);
        signal.addEventListener(
          "abort",
          () => {
            resolve();
          },
          { once: true },
        );
      });
    },
    flush() {
      const batch = pending.splice(0);
      for (const resolve of batch) {
        resolve();
      }
    },
  };
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 1_000,
): Promise<void> {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) {
      throw new Error("timed out waiting for listen condition");
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

describe("createOutboxListener", () => {
  it("forwards NOTIFY on the outbox channel", async () => {
    const broker = createFakeBroker();
    const { logger } = capturingLogger();
    const listener = createOutboxListener({
      connectionString: "postgresql://listen-test",
      logger,
      createClient: broker.createClient,
    });
    let ticks = 0;
    await listener.start(() => {
      ticks += 1;
    });
    broker.clients()[0]?.emitNotify();
    expect(ticks).toBe(1);
    await listener.stop();
  });

  it("reconnects after a dropped connection and logs recovery", async () => {
    const broker = createFakeBroker();
    const { logger, messages } = capturingLogger();
    const listener = createOutboxListener({
      connectionString: "postgresql://listen-test",
      logger,
      createClient: broker.createClient,
      reconnectMinMs: 5,
      reconnectMaxMs: 20,
      downHeartbeatMs: 60_000,
    });
    await listener.start(() => undefined);

    broker.clients()[0]?.emitError(new Error("connection terminated"));
    await waitFor(() => messages().includes("outbox listen recovered"));
    expect(messages()).toContain("outbox listen connection error");
    expect(broker.clients().length).toBeGreaterThanOrEqual(2);
    await listener.stop();
  });

  it("emits a poll-only heartbeat while LISTEN stays down", async () => {
    const broker = createFakeBroker();
    broker.failConnectAt(1);
    broker.failConnectAt(2);
    const delay = createControllableDelay();
    const { logger, messages } = capturingLogger();
    const listener = createOutboxListener({
      connectionString: "postgresql://listen-test",
      logger,
      createClient: broker.createClient,
      delay: delay.delay,
      now: () => 1_000,
      reconnectMinMs: 5,
      reconnectMaxMs: 20,
      downHeartbeatMs: 1,
    });
    await listener.start(() => undefined);

    broker.clients()[0]?.emitError(new Error("connection terminated"));
    await waitFor(() => messages().includes("outbox listen reconnect failed"));
    expect(messages()).toContain("outbox listen down, poll-only");
    await listener.stop();
  });

  it("cancels reconnect backoff on stop", async () => {
    const broker = createFakeBroker();
    broker.failConnectAt(1);
    const delay = createControllableDelay();
    const { logger } = capturingLogger();
    const listener = createOutboxListener({
      connectionString: "postgresql://listen-test",
      logger,
      createClient: broker.createClient,
      delay: delay.delay,
      reconnectMinMs: 60_000,
      reconnectMaxMs: 60_000,
      downHeartbeatMs: 60_000,
    });
    await listener.start(() => undefined);
    broker.clients()[0]?.emitError(new Error("connection terminated"));
    await waitFor(() => broker.clients().length >= 2);
    await listener.stop();
    delay.flush();
    const after = broker.clients().length;
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(broker.clients().length).toBe(after);
  });
});
