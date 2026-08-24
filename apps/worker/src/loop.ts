/**
 * Worker loop (fnd-T27 — core.md §6): dispatch undispatched outbox rows,
 * execute due deliveries, drain in-flight claims on shutdown. Idempotency
 * key expiry is the BullMQ maintenance scheduler (fnd-T29), not this loop.
 * Core owns the libraries; this owns the outbox process.
 */
import {
  cleanupExpiredIdempotencyKeys,
  dispatchOutboxBatch,
  executeDelivery,
  findClaimableDeliveries,
  type ActionPipelineDeps,
  type ClaimableDelivery,
  type DeliveryOutcome,
  type EventSubscription,
  type OutboxDispatchResult,
} from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";
import type { Database } from "@showzy/db";
import type { Logger } from "pino";

import type { OutboxListener } from "./listen.js";
import { POLL_INTERVAL_MS } from "./policy.js";

export interface TickResult {
  readonly claimedEvents: number;
  readonly createdDeliveries: number;
  readonly processed: number;
  readonly alreadyProcessed: number;
  readonly deferred: number;
  readonly failed: number;
}

const EMPTY_TICK: TickResult = {
  claimedEvents: 0,
  createdDeliveries: 0,
  processed: 0,
  alreadyProcessed: 0,
  deferred: 0,
  failed: 0,
};

export interface WorkerLoop {
  readonly workerId: string;
  tick(): Promise<TickResult>;
  cleanup(): Promise<number>;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface WorkerLoopDeps {
  readonly workerId: string;
  readonly logger: Logger;
  readonly pollIntervalMs: number;
  readonly listen?: OutboxListener;
  dispatch(): Promise<OutboxDispatchResult>;
  findDue(): Promise<ClaimableDelivery[]>;
  execute(delivery: ClaimableDelivery): Promise<DeliveryOutcome>;
  cleanup(): Promise<number>;
}

export function createWorkerLoop(deps: WorkerLoopDeps): WorkerLoop {
  const state = {
    stopping: false,
    started: false,
    ticking: false,
  };
  /** Filled by poll/LISTEN while a tick is in flight; opaque so CFA cannot
   *  collapse `size > 0` after `clear()` (requestTick mutates during await). */
  const pendingWakes = new Set<"tick">();
  let chain = Promise.resolve();
  let pollTimer: ReturnType<typeof setInterval> | undefined;

  function serialized<T>(work: () => Promise<T>): Promise<T> {
    const run = chain.then(work, work);
    chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async function runOnce(): Promise<TickResult> {
    const dispatched = await deps.dispatch();
    const due = state.stopping ? [] : await deps.findDue();
    const counts = {
      processed: 0,
      alreadyProcessed: 0,
      deferred: 0,
      failed: 0,
    };
    for (const delivery of due) {
      if (state.stopping) {
        break;
      }
      try {
        const outcome = await deps.execute(delivery);
        countOutcome(counts, outcome);
        if (outcome.status === "failed") {
          deps.logger.error(
            {
              worker_id: deps.workerId,
              consumer: delivery.consumer,
              event_id: delivery.eventId,
              retry_at: outcome.retryAt,
              err: outcome.error,
            },
            "outbox delivery failed",
          );
        }
      } catch (error) {
        counts.failed += 1;
        deps.logger.error(
          {
            worker_id: deps.workerId,
            consumer: delivery.consumer,
            event_id: delivery.eventId,
            err: error,
          },
          "outbox delivery threw",
        );
      }
    }
    const result: TickResult = {
      claimedEvents: dispatched.claimedEvents,
      createdDeliveries: dispatched.createdDeliveries,
      ...counts,
    };
    if (result.claimedEvents > 0 || result.processed > 0 || result.failed > 0) {
      deps.logger.info(
        {
          worker_id: deps.workerId,
          claimed_events: result.claimedEvents,
          created_deliveries: result.createdDeliveries,
          processed: result.processed,
          already_processed: result.alreadyProcessed,
          deferred: result.deferred,
          failed: result.failed,
        },
        "outbox worker tick",
      );
    }
    return result;
  }

  async function tick(): Promise<TickResult> {
    if (state.stopping) {
      return EMPTY_TICK;
    }
    if (state.ticking) {
      pendingWakes.add("tick");
      return EMPTY_TICK;
    }
    return serialized(async () => {
      state.ticking = true;
      try {
        let last = EMPTY_TICK;
        do {
          pendingWakes.clear();
          if (state.stopping) {
            return last;
          }
          last = await runOnce();
        } while (pendingWakes.size > 0);
        return last;
      } finally {
        state.ticking = false;
      }
    });
  }

  function requestTick(): void {
    pendingWakes.add("tick");
    void tick();
  }

  async function cleanup(): Promise<number> {
    if (state.stopping) {
      return 0;
    }
    return serialized(async () => {
      const removed = await deps.cleanup();
      if (removed > 0) {
        deps.logger.info(
          { worker_id: deps.workerId, removed_keys: removed },
          "expired idempotency keys cleaned",
        );
      }
      return removed;
    });
  }

  return {
    workerId: deps.workerId,
    tick,
    cleanup,
    async start() {
      if (state.started || state.stopping) {
        return;
      }
      state.started = true;
      if (deps.listen !== undefined) {
        await deps.listen.start(requestTick);
      }
      deps.logger.info(
        {
          worker_id: deps.workerId,
          poll_interval_ms: deps.pollIntervalMs,
          listen: deps.listen !== undefined,
        },
        "outbox worker started",
      );
      void tick();
      pollTimer = setInterval(() => {
        requestTick();
      }, deps.pollIntervalMs);
    },
    async stop() {
      state.stopping = true;
      if (pollTimer !== undefined) {
        clearInterval(pollTimer);
        pollTimer = undefined;
      }
      if (deps.listen !== undefined) {
        await deps.listen.stop();
      }
      await chain;
      deps.logger.info({ worker_id: deps.workerId }, "outbox worker stopped");
    },
  };
}

export interface CreateOutboxWorkerOptions {
  readonly db: Database;
  readonly pipeline: ActionPipelineDeps;
  readonly subscriptions: readonly EventSubscription[];
  readonly workerId: string;
  readonly logger: Logger;
  readonly listen?: OutboxListener;
  readonly pollIntervalMs?: number;
  readonly now?: () => number;
}

/**
 * Worker executor lookup key. One consumer id may bind multiple events
 * (duplicate is only `(consumer, event)`); indexing by consumer alone
 * overwrites the first binding (core.md §6, SHO-95).
 */
export function consumerEventKey(consumer: string, eventName: string): string {
  return `${consumer}\u0000${eventName}`;
}

/**
 * Indexes subscriptions by `(consumer, eventName)`. Duplicate keys are a
 * composition bug — the contract check already rejects them; failing here
 * keeps a mis-composed worker from silently dropping a binding.
 */
export function indexSubscriptionsByConsumerEvent(
  subscriptions: readonly EventSubscription[],
): ReadonlyMap<string, EventSubscription> {
  const indexed = new Map<string, EventSubscription>();
  for (const subscription of subscriptions) {
    const key = consumerEventKey(
      subscription.consumer,
      subscription.event.name,
    );
    if (indexed.has(key)) {
      throw new CoreInvariantError(
        `duplicate event subscription for consumer "${subscription.consumer}" of "${subscription.event.name}" — executor composition bug`,
      );
    }
    indexed.set(key, subscription);
  }
  return indexed;
}

/**
 * Binds the core dispatcher/executor/cleanup libraries to the process loop.
 */
export function createOutboxWorker(
  options: CreateOutboxWorkerOptions,
): WorkerLoop {
  const byConsumerAndEvent = indexSubscriptionsByConsumerEvent(
    options.subscriptions,
  );
  const clock = options.now !== undefined ? { now: options.now } : {};
  const listen = options.listen !== undefined ? { listen: options.listen } : {};

  return createWorkerLoop({
    workerId: options.workerId,
    logger: options.logger,
    pollIntervalMs: options.pollIntervalMs ?? POLL_INTERVAL_MS,
    ...listen,
    dispatch: () =>
      dispatchOutboxBatch(
        { db: options.pipeline.db, ...clock },
        {
          subscriptions: options.subscriptions,
          claimedBy: options.workerId,
        },
      ),
    findDue: () =>
      findClaimableDeliveries(
        { db: options.pipeline.db },
        { subscriptions: options.subscriptions, ...clock },
      ),
    execute: (delivery) => {
      const subscription = byConsumerAndEvent.get(
        consumerEventKey(delivery.consumer, delivery.eventName),
      );
      if (subscription === undefined) {
        options.logger.error(
          {
            worker_id: options.workerId,
            consumer: delivery.consumer,
            event_id: delivery.eventId,
            event_name: delivery.eventName,
          },
          "no subscription for claimable delivery",
        );
        return Promise.resolve({ status: "deferred" });
      }
      return executeDelivery(options.pipeline, {
        subscription,
        eventId: delivery.eventId,
        claimedBy: options.workerId,
      });
    },
    cleanup: () =>
      options.now === undefined
        ? cleanupExpiredIdempotencyKeys(options.db)
        : cleanupExpiredIdempotencyKeys(options.db, options.now),
  });
}

function countOutcome(
  counts: {
    processed: number;
    alreadyProcessed: number;
    deferred: number;
    failed: number;
  },
  outcome: DeliveryOutcome,
): void {
  switch (outcome.status) {
    case "processed":
      counts.processed += 1;
      break;
    case "alreadyProcessed":
      counts.alreadyProcessed += 1;
      break;
    case "deferred":
      counts.deferred += 1;
      break;
    case "failed":
      counts.failed += 1;
      break;
  }
}
