/**
 * The `ctx.emit` machinery (fnd-T16 — core.md §6).
 *
 * `ctx.emit` is synchronous: the call validates everything checkable at
 * that moment (declared name, payload schema, aggregate shape) and buffers
 * the emission with its UUIDv7 `eventId` and `occurredAt`. The pipeline
 * flushes the buffer in §4 step 9 **inside the execution transaction** —
 * each buffered emission increments its per-aggregate sequence row and
 * inserts one outbox row, so events commit atomically with the handler's
 * effects and a rollback removes rows and sequence increments alike.
 *
 * Buffering is what lets one emission carry the verified identity fields
 * (actor, resolved company scope, channel) without threading them into the
 * context factories: the pipeline supplies the constructed context at flush
 * time. It also keeps the sequence-row lock window at its minimum — the
 * upsert happens just before commit, not mid-handler.
 *
 * Every violation here is a `CoreInvariantError`: the emitting module owns
 * both the definition and the handler, so a bad emission is a server bug,
 * never client input (the action input was validated in step 1).
 */
import { domainEvents, eventAggregateSequences, type Tx } from "@showzy/db";
import { sql } from "drizzle-orm";

import { CoreInvariantError } from "../../errors/index.js";
import type { AnyActionContract } from "../action-registry.js";
import { effectiveCompanyId } from "../context/factories.js";
import {
  SHARE_DURABLE_ACTOR,
  type ActionCtx,
  type CtxEmit,
} from "../context/types.js";
import { UUID_PATTERN } from "../patterns.js";
import type { EventAggregateRef, EventDefinition } from "./define-event.js";
import { uuidv7 } from "./uuidv7.js";

/** One validated `ctx.emit` call, waiting for the step-9 flush. */
interface BufferedEmission {
  readonly definition: EventDefinition;
  readonly aggregate: EventAggregateRef;
  /** UUIDv7, generated at the `ctx.emit` call (core.md §6). */
  readonly eventId: string;
  readonly occurredAt: Date;
  /** The Zod-validated payload (`z.output` of the definition's schema). */
  readonly payload: unknown;
}

/**
 * One invocation's emission buffer. The pipeline creates one per
 * `executeAction` call, hands `emit` to the context factories through
 * `ContextRuntime`, and flushes inside the execution transaction.
 */
export interface EmitBuffer {
  readonly emit: CtxEmit;
  flush(env: {
    readonly tx: Tx;
    /** The execution context — verified actor and company scope. */
    readonly ctx: ActionCtx;
    /** The eventId or requestId that caused this invocation (core.md §6). */
    readonly causationId: string;
  }): Promise<void>;
}

export function createEmitBuffer(options: {
  readonly contract: AnyActionContract;
  /** Clock override for tests; defaults to `Date.now`. */
  readonly now?: () => number;
}): EmitBuffer {
  const { contract } = options;
  const now = options.now ?? Date.now;
  const buffered: BufferedEmission[] = [];
  let sealed = false;

  const emit: CtxEmit = (definition, emission) => {
    if (sealed) {
      throw new CoreInvariantError(
        `"${contract.name}" called ctx.emit after its outbox flush — events are emitted only while the handler runs`,
      );
    }
    // §4: read actions run in a database read-only transaction; their
    // flush could never insert. Rejecting at the call names the real bug.
    if (contract.risk === "read") {
      throw new CoreInvariantError(
        `read action "${contract.name}" cannot emit events — a read-only transaction cannot write the outbox (core.md §4)`,
      );
    }
    if (!contract.emits.includes(definition.name)) {
      throw new CoreInvariantError(
        `action "${contract.name}" emitted undeclared event "${definition.name}" — every emitted event must be listed in the contract's emits (core.md §6)`,
      );
    }
    if (emission.aggregate.type.trim() === "") {
      throw new CoreInvariantError(
        `"${contract.name}" emitted "${definition.name}" with an empty aggregate type`,
      );
    }
    if (!UUID_PATTERN.test(emission.aggregate.id)) {
      throw new CoreInvariantError(
        `"${contract.name}" emitted "${definition.name}" with a malformed aggregate id — aggregate ids are row UUIDs (db.md §4)`,
      );
    }
    const parsed = definition.payload.safeParse(emission.payload);
    if (!parsed.success) {
      throw new CoreInvariantError(
        `payload of "${definition.name}" emitted by "${contract.name}" failed the event's schema: ${JSON.stringify(parsed.error.issues)}`,
      );
    }
    const nowMs = now();
    buffered.push({
      definition,
      aggregate: emission.aggregate,
      eventId: uuidv7(nowMs),
      occurredAt: new Date(nowMs),
      payload: parsed.data,
    });
  };

  return {
    emit,
    async flush({ tx, ctx, causationId }) {
      sealed = true;
      if (buffered.length === 0) {
        return;
      }
      // Event envelopes accept accountable actors only (core.md §2).
      // Public actions cannot declare emits. Share writes remap the
      // anonymous access-log actor to system/share (core.md §6, ADR-0022).
      const actor = ctx.principal === "share" ? SHARE_DURABLE_ACTOR : ctx.actor;
      if (actor.type === "anonymous") {
        throw new CoreInvariantError(
          `"${contract.name}" flushed events with an anonymous actor — event envelopes accept user/system actors only (core.md §2)`,
        );
      }
      // Group by aggregate in first-emission order (which also fixes the
      // sequence-row lock order): one upsert advances each aggregate's
      // sequence by the whole group size, then one multi-row insert writes
      // every outbox row — 2 round trips per aggregate + 1, instead of 2N.
      const groups = groupByAggregate(contract.name, buffered, ctx);
      const rows: (typeof domainEvents.$inferInsert)[] = [];
      for (const group of groups) {
        const lastSequence = await advanceAggregateSequence(
          tx,
          group.aggregate,
          group.companyId,
          BigInt(group.emissions.length),
        );
        let sequence = lastSequence - BigInt(group.emissions.length);
        for (const emission of group.emissions) {
          sequence += 1n;
          rows.push({
            id: emission.eventId,
            name: emission.definition.name,
            version: emission.definition.version,
            occurredAt: emission.occurredAt,
            companyId: emission.companyId,
            aggregateType: emission.aggregate.type,
            aggregateId: emission.aggregate.id,
            aggregateSequence: sequence,
            actorType: actor.type,
            actorId: actor.id,
            channel: ctx.channel,
            requestId: ctx.requestId,
            correlationId: ctx.correlationId,
            causationId,
            payload: emission.payload,
          });
        }
      }
      await tx.insert(domainEvents).values(rows);
    },
  };
}

interface AggregateGroup {
  readonly aggregate: EventAggregateRef;
  /** The first emission's envelope company — the sequence-row insert value. */
  readonly companyId: string | null;
  readonly emissions: (BufferedEmission & {
    readonly companyId: string | null;
  })[];
}

/**
 * Buckets the buffer by `(aggregateType, aggregateId)`, preserving both
 * emission order within a group and first-occurrence order across groups,
 * and resolves each emission's envelope company scope up front.
 */
function groupByAggregate(
  actionName: string,
  buffered: readonly BufferedEmission[],
  ctx: ActionCtx,
): AggregateGroup[] {
  const groups = new Map<string, AggregateGroup>();
  for (const emission of buffered) {
    const companyId = resolveEventCompanyId(
      actionName,
      emission.definition,
      ctx,
    );
    const key = `${emission.aggregate.type}\0${emission.aggregate.id}`;
    let group = groups.get(key);
    if (group === undefined) {
      group = { aggregate: emission.aggregate, companyId, emissions: [] };
      groups.set(key, group);
    }
    group.emissions.push({ ...emission, companyId });
  }
  return [...groups.values()];
}

/**
 * Envelope company scope per the definition (core.md §6): tenant events
 * carry the emitter's verified company and are rejected without one;
 * global events carry null by definition.
 */
function resolveEventCompanyId(
  actionName: string,
  definition: EventDefinition,
  ctx: ActionCtx,
): string | null {
  if (definition.scope === "global") {
    return null;
  }
  const companyId = effectiveCompanyId(ctx);
  if (companyId === null) {
    throw new CoreInvariantError(
      `"${actionName}" emitted tenant-scope event "${definition.name}" without a company scope — tenant events require a verified companyId (core.md §6)`,
    );
  }
  return companyId;
}

/**
 * Advances the per-aggregate sequence row by the whole group size in the
 * flushing transaction (core.md §6 ordering). The upsert takes the row
 * lock, so concurrent emitters for one aggregate serialize on it and
 * sequences stay strictly monotonic; the increments roll back with the
 * transaction. Returns the new `lastSequence` — the group occupies
 * `lastSequence - count + 1 … lastSequence`.
 */
async function advanceAggregateSequence(
  tx: Tx,
  aggregate: EventAggregateRef,
  companyId: string | null,
  count: bigint,
): Promise<bigint> {
  const rows = await tx
    .insert(eventAggregateSequences)
    .values({
      aggregateType: aggregate.type,
      aggregateId: aggregate.id,
      companyId,
      lastSequence: count,
    })
    .onConflictDoUpdate({
      target: [
        eventAggregateSequences.aggregateType,
        eventAggregateSequences.aggregateId,
      ],
      set: {
        lastSequence: sql`${eventAggregateSequences.lastSequence} + ${count}`,
      },
    })
    .returning({ lastSequence: eventAggregateSequences.lastSequence });
  const row = rows[0];
  if (row === undefined) {
    throw new CoreInvariantError(
      `sequence upsert for aggregate ${aggregate.type}:${aggregate.id} returned no row`,
    );
  }
  return row.lastSequence;
}
